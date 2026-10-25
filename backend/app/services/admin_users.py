from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import MemberRole, Permission, UserRole, UserStatus
from app.core.errors import AppError
from app.core.rbac import permission_codes
from app.core.security import hash_password
from app.models.company import Company, CompanyMembership
from app.models.session import AuthSession
from app.models.user import User
from fastapi import status as http_status

ROLE_META: dict[UserRole, dict[str, str]] = {
    UserRole.ENTREPRENEUR: {
        "title": "Предприниматель",
        "description": "Кабинет клиента: компании, заявки, документы, предложения",
    },
    UserRole.ANALYST: {
        "title": "Аналитик",
        "description": "Очередь заявок, проверки, запрос документов, кредитные решения",
    },
    UserRole.ADMIN: {
        "title": "Администратор",
        "description": "Пользователи, каталог, политики, модели, демо-среда",
    },
}

PERMISSION_TITLES: dict[str, str] = {
    Permission.USERS_MANAGE.value: "Управление пользователями и членством",
    Permission.CATALOG_MANAGE.value: "Управление каталогом продуктов",
    Permission.POLICY_EDIT.value: "Редактирование кредитных политик",
    Permission.POLICY_PUBLISH.value: "Публикация кредитных политик",
    Permission.MODELS_MANAGE.value: "Управление ML/LLM моделями",
    Permission.DEMO_RESET.value: "Сброс демо-среды",
    Permission.ANALYTICS_READ.value: "Чтение аналитики",
    Permission.AUDIT_READ.value: "Чтение журнала аудита",
    Permission.APPLICATIONS_REVIEW.value: "Рассмотрение заявок",
    Permission.APPLICATIONS_DECIDE.value: "Вынесение кредитных решений",
    Permission.COMPANIES_READ_CLIENT.value: "Чтение клиентских компаний",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_admin_user(user: User, *, company_ids: list[str] | None = None) -> dict[str, Any]:
    if company_ids is None:
        company_ids = [m.company_id for m in (user.memberships or [])]
    return {
        "id": user.id,
        "login": user.login,
        "email": user.email,
        "phone": user.phone,
        "full_name": user.full_name,
        "role": user.role,
        "status": user.status,
        "is_active": bool(user.is_active),
        "permissions": permission_codes(user.role),
        "company_ids": company_ids,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
    }


def list_roles() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for role in UserRole:
        meta = ROLE_META.get(role, {"title": role.value, "description": ""})
        out.append(
            {
                "role": role,
                "title": meta["title"],
                "description": meta["description"],
                "permissions": permission_codes(role),
            }
        )
    return out


def list_permissions_catalog() -> list[dict[str, str]]:
    return [
        {"code": p.value, "title": PERMISSION_TITLES.get(p.value, p.value)}
        for p in Permission
    ]


def revoke_user_sessions(db: Session, user_id: str) -> int:
    tokens = list(
        db.scalars(
            select(AuthSession).where(
                AuthSession.user_id == user_id,
                AuthSession.revoked.is_(False),
            )
        ).all()
    )
    now = utcnow()
    for t in tokens:
        t.revoked = True
        t.revoked_at = now
    return len(tokens)


def list_users(
    db: Session,
    *,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(User).options(joinedload(User.memberships))
    if role is not None:
        stmt = stmt.where(User.role == role)
    if status is not None:
        stmt = stmt.where(User.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.login.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like),
                User.phone.ilike(like),
            )
        )

    count_stmt = select(func.count(User.id))
    if role is not None:
        count_stmt = count_stmt.where(User.role == role)
    if status is not None:
        count_stmt = count_stmt.where(User.status == status)
    if q:
        like = f"%{q.strip()}%"
        count_stmt = count_stmt.where(
            or_(
                User.login.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like),
                User.phone.ilike(like),
            )
        )
    total = db.scalar(count_stmt) or 0
    users = list(
        db.scalars(stmt.order_by(User.created_at.desc()).offset(offset).limit(min(limit, 100)))
        .unique()
        .all()
    )
    return [serialize_admin_user(u) for u in users], int(total)


def get_user(db: Session, user_id: str) -> User | None:
    return db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.id == user_id)
    )


def _ensure_unique_login_email(
    db: Session,
    *,
    login: str | None,
    email: str | None,
    exclude_id: str | None = None,
) -> None:
    if login:
        q = select(User).where(User.login == login)
        if exclude_id:
            q = q.where(User.id != exclude_id)
        if db.scalar(q):
            raise AppError(
                "LOGIN_TAKEN",
                "Логин уже занят",
                status_code=http_status.HTTP_409_CONFLICT,
                fields=[{"field": "login", "code": "TAKEN"}],
            )
    if email:
        q = select(User).where(User.email == email)
        if exclude_id:
            q = q.where(User.id != exclude_id)
        if db.scalar(q):
            raise AppError(
                "EMAIL_TAKEN",
                "Email уже занят",
                status_code=http_status.HTTP_409_CONFLICT,
                fields=[{"field": "email", "code": "TAKEN"}],
            )


def create_user(
    db: Session,
    *,
    login: str,
    password: str,
    full_name: str,
    role: UserRole,
    email: str | None = None,
    phone: str | None = None,
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    _ensure_unique_login_email(db, login=login, email=email)
    user = User(
        login=login,
        email=email or login,
        phone=phone,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        status=status,
        is_active=status == UserStatus.ACTIVE,
        email_verified_at=utcnow() if status == UserStatus.ACTIVE else None,
    )
    db.add(user)
    db.flush()
    return user


def patch_user(db: Session, user: User, patch: dict[str, Any]) -> User:
    if "login" in patch or "email" in patch:
        _ensure_unique_login_email(
            db,
            login=patch.get("login"),
            email=patch.get("email"),
            exclude_id=user.id,
        )
    for key in ("login", "email", "phone", "full_name", "role", "status", "is_active"):
        if key in patch and patch[key] is not None:
            setattr(user, key, patch[key])
    if "status" in patch and patch["status"] is not None:
        user.is_active = patch["status"] == UserStatus.ACTIVE
    db.flush()
    return user


def disable_user(db: Session, user: User, *, actor_id: str) -> tuple[User, int]:
    if user.id == actor_id:
        raise AppError(
            "CANNOT_DISABLE_SELF",
            "Нельзя отключить собственную учётную запись",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    user.status = UserStatus.DISABLED
    user.is_active = False
    revoked = revoke_user_sessions(db, user.id)
    db.flush()
    return user, revoked


def reset_credentials(db: Session, user: User, password: str) -> int:
    user.password_hash = hash_password(password)
    revoked = revoke_user_sessions(db, user.id)
    db.flush()
    return revoked


def list_admin_companies(db: Session, *, q: str | None = None, limit: int = 50, offset: int = 0):
    stmt = select(Company)
    count_stmt = select(func.count(Company.id))
    if q:
        like = f"%{q.strip()}%"
        filt = or_(Company.name.ilike(like), Company.inn.ilike(like))
        stmt = stmt.where(filt)
        count_stmt = count_stmt.where(filt)
    total = db.scalar(count_stmt) or 0
    companies = list(
        db.scalars(stmt.order_by(Company.name.asc()).offset(offset).limit(min(limit, 100))).all()
    )
    items: list[dict[str, Any]] = []
    for c in companies:
        cnt = db.scalar(
            select(func.count()).select_from(CompanyMembership).where(
                CompanyMembership.company_id == c.id
            )
        ) or 0
        items.append(
            {
                "id": c.id,
                "inn": c.inn,
                "name": c.name,
                "legal_form": c.legal_form.value if hasattr(c.legal_form, "value") else str(c.legal_form),
                "registry_status": c.registry_status,
                "region": c.region,
                "members_count": int(cnt),
            }
        )
    return items, int(total)


def list_members(db: Session, company_id: str) -> list[dict[str, Any]]:
    company = db.get(Company, company_id)
    if company is None:
        raise AppError("NOT_FOUND", "Компания не найдена", status_code=http_status.HTTP_404_NOT_FOUND)
    rows = list(
        db.scalars(
            select(CompanyMembership)
            .options(joinedload(CompanyMembership.user))
            .where(CompanyMembership.company_id == company_id)
            .order_by(CompanyMembership.created_at.asc())
        ).unique().all()
    )
    out: list[dict[str, Any]] = []
    for m in rows:
        u = m.user
        out.append(
            {
                "user_id": m.user_id,
                "company_id": m.company_id,
                "role": m.role,
                "full_name": u.full_name if u else None,
                "email": u.email if u else None,
                "login": u.login if u else None,
                "user_role": u.role if u else None,
                "permissions": m.permissions or {},
                "created_at": m.created_at,
            }
        )
    return out


def upsert_member(
    db: Session,
    *,
    company_id: str,
    user_id: str,
    role: MemberRole,
    permissions: dict | None = None,
) -> CompanyMembership:
    company = db.get(Company, company_id)
    if company is None:
        raise AppError("NOT_FOUND", "Компания не найдена", status_code=http_status.HTTP_404_NOT_FOUND)
    user = db.get(User, user_id)
    if user is None:
        raise AppError("NOT_FOUND", "Пользователь не найден", status_code=http_status.HTTP_404_NOT_FOUND)

    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    if membership is None:
        membership = CompanyMembership(
            company_id=company_id,
            user_id=user_id,
            role=role,
            permissions=permissions
            or {"read": True, "write": role != MemberRole.VIEWER, "submit": role == MemberRole.OWNER},
        )
        db.add(membership)
    else:
        membership.role = role
        if permissions is not None:
            membership.permissions = permissions
    db.flush()
    return membership


def delete_member(db: Session, *, company_id: str, user_id: str) -> None:
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise AppError("NOT_FOUND", "Членство не найдено", status_code=http_status.HTTP_404_NOT_FOUND)
    db.delete(membership)
    db.flush()
