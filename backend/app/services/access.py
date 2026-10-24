from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ApplicationStatus, Permission, UserRole
from app.core.rbac import has_permission
from app.models.application import CreditApplication
from app.models.company import Company, CompanyMember
from app.models.user import User

ANALYST_ROLES = {UserRole.ANALYST}
COMPANY_CLIENT_ROLES = {UserRole.ENTREPRENEUR}
BANK_STAFF_ROLES = {UserRole.ANALYST}


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


def list_accessible_companies(db: Session, user: User) -> list[tuple[Company, CompanyMember | None]]:
    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Администратор работает через /admin/*",
        )

    if user.role in BANK_STAFF_ROLES:
        if not has_permission(user.role, Permission.COMPANIES_READ_CLIENT):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        company_ids = db.scalars(
            select(CreditApplication.company_id)
            .where(CreditApplication.status != ApplicationStatus.DRAFT)
            .distinct()
        ).all()
        if not company_ids:
            return []
        companies = list(
            db.scalars(select(Company).where(Company.id.in_(company_ids)).order_by(Company.name)).all()
        )
        return [(c, None) for c in companies]

    rows = db.execute(
        select(Company, CompanyMember)
        .join(CompanyMember, CompanyMember.company_id == Company.id)
        .where(CompanyMember.user_id == user.id)
        .order_by(Company.name)
    ).all()
    return [(company, membership) for company, membership in rows]


def _analyst_can_read_company(db: Session, company_id: str) -> bool:
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


def require_permission(user: User, permission: Permission) -> None:
    if not has_permission(user.role, permission):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")


def require_company_access(
    db: Session,
    user: User,
    company_id: str,
    *,
    write: bool = False,
) -> None:
    if not company_id:
        deny_not_found("Компания не найдена")

    if user.role in BANK_STAFF_ROLES:
        if write:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Аналитик не может изменять данные компании клиента",
            )
        if not has_permission(user.role, Permission.COMPANIES_READ_CLIENT):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        if not _analyst_can_read_company(db, company_id):
            deny_not_found("Компания не найдена")
        return

    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Администратор работает через /admin/*",
        )

    membership = get_membership(db, user.id, company_id)
    if membership is None:
        deny_not_found("Компания не найдена")

    if write:
        if user.role not in COMPANY_CLIENT_ROLES:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав на изменение")
        if membership.role.value == "VIEWER":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав на изменение")


def require_application_access(
    db: Session,
    user: User,
    application: CreditApplication,
    *,
    write: bool = False,
) -> None:
    if user.role in BANK_STAFF_ROLES:
        if write and not has_permission(user.role, Permission.APPLICATIONS_REVIEW):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        if application.status == ApplicationStatus.DRAFT:
            deny_not_found("Заявка не найдена")
        return

    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Администратор не обрабатывает заявки клиентов",
        )

    membership = get_membership(db, user.id, application.company_id)
    if membership is None:
        deny_not_found("Заявка не найдена")
    if write and membership.role.value == "VIEWER":
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
    if user.role not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
