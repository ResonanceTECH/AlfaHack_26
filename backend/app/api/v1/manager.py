from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.enums import ApplicationStatus, UserRole
from app.deps import CurrentUser, DbDep
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.finance import FinancialSnapshot
from app.schemas.analyst import AnalystQueueOut
from app.schemas.company import CompanyOut, FinancialSnapshotOut
from app.services.access import require_application_access, require_roles

router = APIRouter(prefix="/manager", tags=["manager"])


@router.get("/applications", response_model=AnalystQueueOut, deprecated=True)
def manager_queue(
    db: DbDep,
    user: CurrentUser,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    product_id: str | None = None,
    assigned_to_me: bool = False,
) -> AnalystQueueOut:
    """Deprecated: используйте GET /analyst/applications."""
    from app.api.v1.analyst import analyst_applications_queue

    return analyst_applications_queue(
        db=db,
        user=user,
        status_filter=status_filter,
        product_id=product_id,
        assigned_to_me=assigned_to_me,
        unassigned=False,
        q=None,
        include_closed=True,
        limit=50,
        offset=0,
    )

@router.get("/applications/{application_id}/company", response_model=CompanyOut)
def manager_company(application_id: str, db: DbDep, user: CurrentUser) -> Company:
    from fastapi import HTTPException, status

    require_roles(user, UserRole.ANALYST)
    app = db.get(CreditApplication, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Не найдено")
    require_application_access(db, user, app)
    company = db.get(Company, app.company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Не найдено")
    return company

@router.get("/applications/{application_id}/financials", response_model=FinancialSnapshotOut)
def manager_financials(application_id: str, db: DbDep, user: CurrentUser) -> FinancialSnapshot:
    from fastapi import HTTPException, status

    require_roles(user, UserRole.ANALYST)
    app = db.get(CreditApplication, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app)
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == app.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    if snap is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Финансы не найдены")
    return snap
