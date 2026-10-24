from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ApplicationStatus
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.user import User
from app.services.applications import application_number

DEFAULT_QUEUE_STATUSES: set[ApplicationStatus] = {
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.VALIDATING,
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.DOCS_REQUESTED,
    ApplicationStatus.APPROVED,
    ApplicationStatus.COUNTEROFFERED,
    ApplicationStatus.OFFER_ACCEPTED,
    ApplicationStatus.AGREEMENT_PREPARATION,
}


def serialize_queue_item(app: CreditApplication, *, open_doc_requests: int = 0) -> dict[str, Any]:
    company = app.company
    analyst = app.assigned_analyst or app.assigned_manager
    return {
        "id": app.id,
        "application_number": application_number(app) if app.status != ApplicationStatus.DRAFT else None,
        "company_id": app.company_id,
        "company_name": company.name if company else None,
        "inn": company.inn if company else None,
        "status": app.status,
        "current_step": app.current_step,
        "product_id": app.product_id,
        "product_name": app.product_name,
        "amount": app.amount,
        "term_months": app.term_months,
        "rate": app.rate,
        "readiness_score": app.readiness_score or 0,
        "assigned_analyst_id": app.assigned_analyst_id or app.assigned_manager_id,
        "assigned_analyst_name": analyst.full_name if analyst else None,
        "open_document_requests": open_doc_requests,
        "submitted_at": app.submitted_at,
        "updated_at": app.updated_at,
        "created_at": app.created_at,
    }


def _apply_filters(
    stmt,
    *,
    user: User,
    status_filter: ApplicationStatus | None,
    product_id: str | None,
    assigned_to_me: bool,
    unassigned: bool,
    q: str | None,
    include_closed: bool,
):
    stmt = stmt.where(CreditApplication.status != ApplicationStatus.DRAFT)
    if status_filter is not None:
        stmt = stmt.where(CreditApplication.status == status_filter)
    elif not include_closed:
        stmt = stmt.where(CreditApplication.status.in_(tuple(DEFAULT_QUEUE_STATUSES)))
    if product_id:
        stmt = stmt.where(CreditApplication.product_id == product_id)
    if assigned_to_me:
        stmt = stmt.where(
            or_(
                CreditApplication.assigned_analyst_id == user.id,
                CreditApplication.assigned_manager_id == user.id,
            )
        )
    if unassigned:
        stmt = stmt.where(
            CreditApplication.assigned_analyst_id.is_(None),
            CreditApplication.assigned_manager_id.is_(None),
        )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.join(Company, Company.id == CreditApplication.company_id).where(
            or_(
                Company.name.ilike(like),
                Company.inn.ilike(like),
                CreditApplication.product_name.ilike(like),
                CreditApplication.id.ilike(like),
            )
        )
    return stmt


def list_analyst_queue(
    db: Session,
    *,
    user: User,
    status_filter: ApplicationStatus | None = None,
    product_id: str | None = None,
    assigned_to_me: bool = False,
    unassigned: bool = False,
    q: str | None = None,
    include_closed: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int, dict[str, int]]:
    filters = dict(
        user=user,
        status_filter=status_filter,
        product_id=product_id,
        assigned_to_me=assigned_to_me,
        unassigned=unassigned,
        q=q,
        include_closed=include_closed,
    )

    count_stmt = _apply_filters(select(func.count(func.distinct(CreditApplication.id))), **filters)
    total = db.scalar(count_stmt) or 0

    counts_stmt = select(CreditApplication.status, func.count()).where(
        CreditApplication.status != ApplicationStatus.DRAFT
    )
    if not include_closed:
        counts_stmt = counts_stmt.where(CreditApplication.status.in_(tuple(DEFAULT_QUEUE_STATUSES)))
    counts_stmt = counts_stmt.group_by(CreditApplication.status)
    counts = {
        (st.value if isinstance(st, ApplicationStatus) else str(st)): int(n)
        for st, n in db.execute(counts_stmt).all()
    }

    list_stmt = _apply_filters(
        select(CreditApplication).options(
            joinedload(CreditApplication.company),
            joinedload(CreditApplication.assigned_analyst),
            joinedload(CreditApplication.assigned_manager),
            joinedload(CreditApplication.document_requests),
        ),
        **filters,
    )
    apps = list(
        db.scalars(
            list_stmt.order_by(CreditApplication.updated_at.desc()).offset(offset).limit(min(limit, 100))
        )
        .unique()
        .all()
    )

    items: list[dict[str, Any]] = []
    for app in apps:
        open_reqs = sum(
            1
            for r in (app.document_requests or [])
            if (r.status or "").upper() in ("OPEN", "PENDING", "REQUESTED")
        )
        items.append(serialize_queue_item(app, open_doc_requests=open_reqs))

    return items, int(total), counts
