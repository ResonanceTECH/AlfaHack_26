from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status as http_status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import MemberRole
from app.core.errors import AppError
from app.models.company import Company, CompanyInvite, CompanyMembership
from app.models.user import User
from app.services.access import get_membership, require_company_access
from app.services.admin_users import delete_member as admin_delete_member
from app.services.admin_users import list_members, upsert_member
from app.services.notifications import notify


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_invite(invite: CompanyInvite) -> dict[str, Any]:
    company = getattr(invite, "company", None)
    inviter = getattr(invite, "inviter", None)
    return {
        "id": invite.id,
        "company_id": invite.company_id,
        "email": invite.email,
        "role": invite.role,
        "code": invite.code,
        "status": invite.status,
        "invited_by": invite.invited_by,
        "expires_at": invite.expires_at,
        "created_at": invite.created_at,
        "message": invite.message,
        "company_name": company.name if company is not None else None,
        "invited_by_name": inviter.full_name if inviter is not None else None,
    }


def serialize_member(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": row["user_id"],
        "company_id": row["company_id"],
        "role": row["role"],
        "full_name": row.get("full_name"),
        "email": row.get("email"),
        "login": row.get("login"),
        "status": row.get("status"),
        "last_login_at": row.get("last_login_at"),
        "permissions": row.get("permissions") or {},
        "created_at": row.get("created_at"),
    }


def can_manage_team(membership: CompanyMembership | None) -> bool:
    if membership is None:
        return False
    perms = membership.permissions or {}
    return membership.role == MemberRole.OWNER or bool(perms.get("manage_team"))


def require_manage_team(db: Session, user: User, company_id: str) -> CompanyMembership:
    require_company_access(db, user, company_id, write=True)
    membership = get_membership(db, user.id, company_id)
    if not can_manage_team(membership):
        raise HTTPException(
            http_status.HTTP_403_FORBIDDEN,
            detail="Управлять командой может только владелец",
        )
    assert membership is not None
    return membership


def owner_count(db: Session, company_id: str) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(CompanyMembership)
            .where(
                CompanyMembership.company_id == company_id,
                CompanyMembership.role == MemberRole.OWNER,
            )
        )
        or 0
    )


def list_company_members(db: Session, company_id: str) -> list[dict[str, Any]]:
    return [serialize_member(row) for row in list_members(db, company_id)]


_INVITE_LOAD = (
    selectinload(CompanyInvite.company),
    selectinload(CompanyInvite.inviter),
)


def list_pending_invites(db: Session, company_id: str) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(CompanyInvite)
            .options(*_INVITE_LOAD)
            .where(
                CompanyInvite.company_id == company_id,
                CompanyInvite.status == "PENDING",
            )
            .order_by(CompanyInvite.created_at.desc())
        ).all()
    )
    return [serialize_invite(i) for i in rows]


def list_my_pending_invites(db: Session, user: User) -> list[dict[str, Any]]:
    """Invites addressed to the current user's email (inbox for invitee)."""
    email = (user.email or "").strip().lower()
    if not email:
        return []
    rows = list(
        db.scalars(
            select(CompanyInvite)
            .options(*_INVITE_LOAD)
            .where(
                func.lower(CompanyInvite.email) == email,
                CompanyInvite.status == "PENDING",
            )
            .order_by(CompanyInvite.created_at.desc())
        ).all()
    )
    # drop expired
    out: list[dict[str, Any]] = []
    now = utcnow()
    for inv in rows:
        exp = inv.expires_at
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now:
                continue
        out.append(serialize_invite(inv))
    return out


def create_invite(
    db: Session,
    *,
    company_id: str,
    email: str,
    role: MemberRole,
    invited_by: str | None,
    message: str | None = None,
) -> CompanyInvite:
    if role == MemberRole.OWNER:
        raise AppError(
            "OWNER_INVITE_FORBIDDEN",
            "Нельзя пригласить с ролью OWNER",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "role", "code": "FORBIDDEN"}],
        )
    if role not in (MemberRole.MEMBER, MemberRole.VIEWER):
        raise AppError(
            "INVALID_INVITE_ROLE",
            "Приглашение только для MEMBER или VIEWER",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": "role", "code": "INVALID"}],
        )

    email_norm = email.strip().lower()
    existing = db.scalar(
        select(CompanyInvite).where(
            CompanyInvite.company_id == company_id,
            CompanyInvite.email == email_norm,
            CompanyInvite.status == "PENDING",
        )
    )
    if existing is not None:
        existing.role = role
        existing.message = message
        existing.expires_at = utcnow() + timedelta(days=7)
        if invited_by:
            existing.invited_by = invited_by
        db.flush()
        _notify_invitee(db, existing)
        return existing

    invite = CompanyInvite(
        company_id=company_id,
        email=email_norm,
        role=role,
        code=uuid4().hex,
        invited_by=invited_by,
        expires_at=utcnow() + timedelta(days=7),
        status="PENDING",
        message=message,
    )
    db.add(invite)
    db.flush()
    _notify_invitee(db, invite)
    return invite


def _notify_invitee(db: Session, invite: CompanyInvite) -> None:
    """If invitee already has an account — push in-app notification into their LK."""
    invitee = db.scalar(select(User).where(func.lower(User.email) == invite.email))
    if invitee is None:
        return
    company = db.get(Company, invite.company_id)
    company_name = company.name if company else "компанию"
    notify(
        db,
        user_id=invitee.id,
        type="TEAM_INVITE",
        title=f"Приглашение в команду «{company_name}»",
        body=invite.message
        or f"Вас пригласили с ролью {invite.role.value}. Откройте раздел «Команда» или перейдите по ссылке.",
        payload={
            "invite_id": invite.id,
            "company_id": invite.company_id,
            "company_name": company_name,
            "code": invite.code,
            "role": invite.role.value,
        },
    )


def revoke_invite(db: Session, company_id: str, invite_id: str) -> CompanyInvite:
    invite = db.get(CompanyInvite, invite_id)
    if invite is None or invite.company_id != company_id:
        raise AppError("NOT_FOUND", "Приглашение не найдено", status_code=http_status.HTTP_404_NOT_FOUND)
    if invite.status != "PENDING":
        raise AppError(
            "INVITE_NOT_PENDING",
            f"Приглашение уже {invite.status}",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    invite.status = "REVOKED"
    db.flush()
    return invite


def patch_member_role(db: Session, *, company_id: str, user_id: str, role: MemberRole) -> CompanyMembership:
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise AppError("NOT_FOUND", "Членство не найдено", status_code=http_status.HTTP_404_NOT_FOUND)
    if membership.role == MemberRole.OWNER and role != MemberRole.OWNER:
        if owner_count(db, company_id) <= 1:
            raise AppError(
                "LAST_OWNER",
                "Нельзя снять последнего владельца",
                status_code=http_status.HTTP_409_CONFLICT,
            )
    return upsert_member(db, company_id=company_id, user_id=user_id, role=role)


def remove_member(db: Session, *, company_id: str, user_id: str) -> None:
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise AppError("NOT_FOUND", "Членство не найдено", status_code=http_status.HTTP_404_NOT_FOUND)
    if membership.role == MemberRole.OWNER and owner_count(db, company_id) <= 1:
        raise AppError(
            "LAST_OWNER",
            "Нельзя удалить последнего владельца",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    admin_delete_member(db, company_id=company_id, user_id=user_id)


def accept_invite(db: Session, *, code: str, user: User) -> CompanyMembership:
    invite = db.scalar(select(CompanyInvite).where(CompanyInvite.code == code))
    if invite is None:
        raise AppError("NOT_FOUND", "Приглашение не найдено", status_code=http_status.HTTP_404_NOT_FOUND)
    if invite.status != "PENDING":
        raise AppError(
            "INVITE_NOT_PENDING",
            f"Приглашение уже {invite.status}",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    exp = invite.expires_at
    if exp is not None:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < utcnow():
            invite.status = "REVOKED"
            db.flush()
            raise AppError(
                "INVITE_EXPIRED",
                "Срок приглашения истёк",
                status_code=http_status.HTTP_409_CONFLICT,
            )
    if invite.role == MemberRole.OWNER:
        raise AppError(
            "OWNER_INVITE_FORBIDDEN",
            "Нельзя принять приглашение владельца",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    membership = upsert_member(
        db,
        company_id=invite.company_id,
        user_id=user.id,
        role=invite.role,
    )
    invite.status = "ACCEPTED"
    db.flush()
    return membership
