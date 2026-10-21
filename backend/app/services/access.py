from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ApplicationStatus, UserRole
from app.models.application import CreditApplication
from app.models.company import CompanyMember
from app.models.user import User

MANAGER_ROLES = {UserRole.MANAGER, UserRole.RISK_ANALYST, UserRole.ADMIN}
COMPANY_CLIENT_ROLES = {UserRole.ENTREPRENEUR, UserRole.ACCOUNTANT}
BANK_STAFF_ROLES = {UserRole.MANAGER, UserRole.RISK_ANALYST}

def get_membership(db: Session, user_id: str, company_id: str) -> CompanyMember | None:
    return db.scalar(
        select(CompanyMember).where(
            CompanyMember.user_id == user_id,
            CompanyMember.company_id == company_id,
        )
    )

def user_company_ids(db: Session, user: User) -> set[str]:
    rows = db.scalars(select(CompanyMember.company_id).where(CompanyMember.user_id == user.id)).all()
    return set(rows)

def _manager_can_read_company(db: Session, company_id: str) -> bool:
    exists = db.scalar(
        select(CreditApplication.id)
        .where(
            CreditApplication.company_id == company_id,
            CreditApplication.status != ApplicationStatus.DRAFT,
        )
        .limit(1)
    )
    return exists is not None

def deny_not_found(detail: str = "Ресурс не найден") -> None:
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail=detail)

def require_company_access(
    db: Session,
    user: User,
    company_id: str,
    *,
    write: bool = False,
) -> None:
    if not company_id:
        deny_not_found("Компания не найдена")

    if user.role == UserRole.ADMIN:
        return

    if user.role in BANK_STAFF_ROLES:
        if write:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Менеджер не может изменять данные компании клиента",
            )
        if not _manager_can_read_company(db, company_id):
            deny_not_found("Компания не найдена")
        return

    membership = get_membership(db, user.id, company_id)
    if membership is None:
        deny_not_found("Компания не найдена")

    if write:
        if user.role not in COMPANY_CLIENT_ROLES and user.role != UserRole.ADMIN:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав на изменение")
        if membership.role.value == "viewer":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав на изменение")

def require_application_access(
    db: Session,
    user: User,
    application: CreditApplication,
    *,
    write: bool = False,
) -> None:
    if user.role == UserRole.ADMIN:
        return

    if user.role in BANK_STAFF_ROLES:
        if write:
            return
        if application.status == ApplicationStatus.DRAFT:
            deny_not_found("Заявка не найдена")
        return

    membership = get_membership(db, user.id, application.company_id)
    if membership is None:
        deny_not_found("Заявка не найдена")
    if write and membership.role.value == "viewer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав на изменение")

def resolve_company_id(db: Session, user: User, requested: str | None) -> str:
    if requested:
        require_company_access(db, user, requested, write=False)
        return requested

    own = user.company_id
    if own:
        return own

    ids = user_company_ids(db, user)
    if len(ids) == 1:
        return next(iter(ids))

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        detail="Укажите company_id своей компании",
    )

def require_roles(user: User, *roles: UserRole) -> None:
    if user.role not in roles and user.role != UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
