from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.enums import ApplicationStatus, UserRole
from app.deps import CurrentUser, DbDep
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.finance import FinancialSnapshot
from app.schemas.application import ApplicationOut
from app.schemas.company import CompanyOut, FinancialSnapshotOut
from app.services.access import require_application_access, require_roles

router = APIRouter(prefix="/manager", tags=["manager"])

def _serialize(app: CreditApplication) -> dict:
    manager_name = app.assigned_manager.full_name if app.assigned_manager else None
    return {
        "id": app.id,
        "company_id": app.company_id,
        "product_id": app.product_id,
        "product_name": app.product_name,
        "status": app.status,
        "amount": app.amount,
        "term_months": app.term_months,
        "rate": app.rate,
        "purpose": app.purpose,
        "assigned_manager_id": app.assigned_manager_id,
        "assigned_manager_name": manager_name,
        "readiness_score": app.readiness_score,
        "documents": [
            {
                "id": d.id,
                "type": d.document_type,
                "name": d.name,
                "size": d.size,
                "uploaded_at": d.uploaded_at,
                "status": d.status,
            }
            for d in app.documents
        ],
        "comments": [
            {
                "id": c.id,
                "author_id": c.author_id,
                "author_name": c.author_name,
                "author_role": c.author_role,
                "text": c.text,
                "created_at": c.created_at,
            }
            for c in app.comments
        ],
        "status_history": app.status_history or [],
        "created_at": app.created_at,
        "updated_at": app.updated_at,
        "ai_summary": app.ai_summary,
    }

@router.get("/applications", response_model=list[ApplicationOut])
def manager_queue(
    db: DbDep,
    user: CurrentUser,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    product_id: str | None = None,
    assigned_to_me: bool = False,
) -> list[dict]:
    require_roles(user, UserRole.ANALYST)
    q = (
        select(CreditApplication)
        .options(
            joinedload(CreditApplication.documents),
            joinedload(CreditApplication.comments),
            joinedload(CreditApplication.assigned_manager),
        )
        .where(CreditApplication.status != ApplicationStatus.DRAFT)
    )
    if status_filter:
        q = q.where(CreditApplication.status == status_filter)
    if product_id:
        q = q.where(CreditApplication.product_id == product_id)
    if assigned_to_me:
        q = q.where(CreditApplication.assigned_manager_id == user.id)

    apps = db.scalars(q.order_by(CreditApplication.updated_at.desc())).unique().all()
    return [_serialize(a) for a in apps]

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
