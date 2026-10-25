from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.deps import CorrelationId, CurrentUser, DbDep
from app.schemas.common import MessageOut
from app.schemas.company import (
    CompanyInviteCreate,
    CompanyInviteOut,
    CompanyMemberOut,
    CompanyMemberPatch,
)
from app.services.access import require_company_access
from app.services.admin_users import list_members
from app.services.audit import write_audit
from app.services.company_team import (
    accept_invite,
    create_invite,
    decline_invite,
    list_company_members,
    list_my_pending_invites,
    list_pending_invites,
    patch_member_role,
    remove_member,
    require_manage_team,
    revoke_invite,
    serialize_invite,
    serialize_member,
)

router = APIRouter(tags=["team"])


@router.get("/companies/{company_id}/members", response_model=list[CompanyMemberOut])
def company_members(company_id: str, db: DbDep, user: CurrentUser) -> list[CompanyMemberOut]:
    require_company_access(db, user, company_id)
    return [CompanyMemberOut(**m) for m in list_company_members(db, company_id)]


@router.get("/invites/mine", response_model=list[CompanyInviteOut])
def my_invites(db: DbDep, user: CurrentUser) -> list[CompanyInviteOut]:
    """Inbox приглашённого: pending invites на email текущего пользователя."""
    return [CompanyInviteOut(**i) for i in list_my_pending_invites(db, user)]


@router.post(
    "/companies/{company_id}/members/invites",
    response_model=CompanyInviteOut,
    status_code=status.HTTP_201_CREATED,
)
def company_create_invite(
    company_id: str,
    body: CompanyInviteCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> CompanyInviteOut:
    require_manage_team(db, user, company_id)
    invite = create_invite(
        db,
        company_id=company_id,
        email=body.email,
        role=body.role,
        invited_by=user.id,
        message=body.message,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_invite",
        entity_id=invite.id,
        action="invite_create",
        details={"email": invite.email, "role": invite.role.value},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    db.refresh(invite)
    return CompanyInviteOut(**serialize_invite(invite))


@router.get("/companies/{company_id}/members/invites", response_model=list[CompanyInviteOut])
def company_list_invites(
    company_id: str, db: DbDep, user: CurrentUser
) -> list[CompanyInviteOut]:
    require_company_access(db, user, company_id)
    return [CompanyInviteOut(**i) for i in list_pending_invites(db, company_id)]


@router.delete(
    "/companies/{company_id}/members/invites/{invite_id}",
    response_model=MessageOut,
)
def company_revoke_invite(
    company_id: str,
    invite_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> MessageOut:
    require_manage_team(db, user, company_id)
    invite = revoke_invite(db, company_id, invite_id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_invite",
        entity_id=invite.id,
        action="invite_revoke",
        details={"email": invite.email},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return MessageOut(message="ok")


@router.patch(
    "/companies/{company_id}/members/{user_id}",
    response_model=CompanyMemberOut,
)
def company_patch_member(
    company_id: str,
    user_id: str,
    body: CompanyMemberPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> CompanyMemberOut:
    require_manage_team(db, user, company_id)
    patch_member_role(db, company_id=company_id, user_id=user_id, role=body.role)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_membership",
        entity_id=f"{company_id}:{user_id}",
        action="member_role_patch",
        details={"role": body.role.value},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    members = {m["user_id"]: m for m in list_company_members(db, company_id)}
    if user_id not in members:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Членство не найдено")
    return CompanyMemberOut(**members[user_id])


@router.delete(
    "/companies/{company_id}/members/{user_id}",
    response_model=MessageOut,
)
def company_delete_member(
    company_id: str,
    user_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> MessageOut:
    require_manage_team(db, user, company_id)
    remove_member(db, company_id=company_id, user_id=user_id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_membership",
        entity_id=f"{company_id}:{user_id}",
        action="member_delete",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return MessageOut(message="ok")


@router.post("/invites/{code}/decline", response_model=MessageOut)
def decline_company_invite(
    code: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> MessageOut:
    invite = decline_invite(db, code=code, user=user)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_invite",
        entity_id=invite.id,
        action="invite_decline",
        details={"company_id": invite.company_id},
        correlation_id=cid,
        company_id=invite.company_id,
    )
    db.commit()
    return MessageOut(message="ok")


@router.post("/invites/{code}/accept", response_model=CompanyMemberOut)
def accept_company_invite(
    code: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> CompanyMemberOut:
    membership = accept_invite(db, code=code, user=user)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_invite",
        entity_id=membership.id,
        action="invite_accept",
        details={"company_id": membership.company_id, "role": membership.role.value},
        correlation_id=cid,
        company_id=membership.company_id,
    )
    db.commit()
    members = {m["user_id"]: m for m in list_members(db, membership.company_id)}
    row = members.get(user.id) or serialize_member(
        {
            "user_id": user.id,
            "company_id": membership.company_id,
            "role": membership.role,
            "full_name": user.full_name,
            "email": user.email,
            "login": user.login,
            "status": user.status,
            "last_login_at": user.last_login_at,
            "permissions": membership.permissions or {},
            "created_at": membership.created_at,
        }
    )
    return CompanyMemberOut(**row)
