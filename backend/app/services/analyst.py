from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ApplicationStatus, CheckAudience
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.finance import FinancialSnapshot
from app.models.user import User
from app.services.applications import application_number, serialize_application
from app.services.documents import serialize_document_request
from app.services.workflow import (
    active_workflow,
    analyst_visible_checks,
    serialize_check,
)

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


def _allowed_actions(status: ApplicationStatus) -> list[str]:
    mapping: dict[ApplicationStatus, list[str]] = {
        ApplicationStatus.SUBMITTED: ["REQUEST_DOCS", "APPROVE", "REJECT", "COUNTEROFFER"],
        ApplicationStatus.VALIDATING: ["REQUEST_DOCS", "APPROVE", "REJECT", "COUNTEROFFER"],
        ApplicationStatus.IN_REVIEW: ["REQUEST_DOCS", "APPROVE", "REJECT", "COUNTEROFFER"],
        ApplicationStatus.DOCS_REQUESTED: ["REQUEST_DOCS", "REJECT"],
        ApplicationStatus.APPROVED: [],
        ApplicationStatus.COUNTEROFFERED: ["REQUEST_DOCS", "APPROVE", "REJECT", "COUNTEROFFER"],
        ApplicationStatus.OFFER_ACCEPTED: [],
        ApplicationStatus.AGREEMENT_PREPARATION: [],
        ApplicationStatus.REJECTED: [],
        ApplicationStatus.ISSUED: [],
    }
    return list(mapping.get(status, []))


def _checks_summary(app: CreditApplication) -> dict[str, Any]:
    checks = list(app.checks or [])
    by_status: dict[str, int] = {}
    by_audience: dict[str, int] = {}
    for c in checks:
        st = (c.status or "UNKNOWN").upper()
        by_status[st] = by_status.get(st, 0) + 1
        aud = (c.audience or CheckAudience.PUBLIC.value).upper()
        by_audience[aud] = by_audience.get(aud, 0) + 1
    return {
        "total": len(checks),
        "by_status": by_status,
        "by_audience": by_audience,
        "passed": by_status.get("PASSED", 0),
        "failed": by_status.get("FAILED", 0),
        "warnings": by_status.get("WARNING", 0) + by_status.get("WARN", 0),
        "internal_count": by_audience.get(CheckAudience.INTERNAL.value, 0)
        + by_audience.get(CheckAudience.ANALYST.value, 0),
    }


def get_analyst_application(db: Session, application_id: str) -> CreditApplication | None:
    return db.scalar(
        select(CreditApplication)
        .options(
            joinedload(CreditApplication.company),
            joinedload(CreditApplication.assigned_analyst),
            joinedload(CreditApplication.assigned_manager),
            joinedload(CreditApplication.documents),
            joinedload(CreditApplication.comments),
            joinedload(CreditApplication.workflows),
            joinedload(CreditApplication.checks),
            joinedload(CreditApplication.document_requests),
            joinedload(CreditApplication.decisions),
            joinedload(CreditApplication.offers),
        )
        .where(CreditApplication.id == application_id)
    )


def build_analyst_card(db: Session, app: CreditApplication) -> dict[str, Any]:
    company = app.company or db.get(Company, app.company_id)
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == app.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
        .limit(1)
    )
    wf = active_workflow(app)
    open_reqs = [
        serialize_document_request(r)
        for r in (app.document_requests or [])
        if (r.status or "").upper() in ("OPEN", "PENDING", "REQUESTED")
    ]

    application = serialize_application(app)
    application["application_number"] = (
        application_number(app) if app.status != ApplicationStatus.DRAFT else None
    )
    analyst = app.assigned_analyst or app.assigned_manager
    application["assigned_analyst_id"] = app.assigned_analyst_id or app.assigned_manager_id
    application["assigned_analyst_name"] = analyst.full_name if analyst else None
    application["ai_summary"] = app.ai_summary
    application["rejection_reason"] = app.rejection_reason

    company_out = None
    if company is not None:
        company_out = {
            "id": company.id,
            "inn": company.inn,
            "name": company.name,
            "legal_form": company.legal_form,
            "ogrn": company.ogrn,
            "industry": company.industry,
            "registration_date": company.registration_date,
            "region": company.region,
            "employees_count": company.employees_count,
            "registry_status": company.registry_status,
            "version": company.version,
        }

    financials = None
    if snap is not None:
        financials = {
            "id": snap.id,
            "company_id": snap.company_id,
            "period": snap.period,
            "avg_monthly_revenue": snap.avg_monthly_revenue,
            "operating_expenses": snap.operating_expenses,
            "cash_balance": snap.cash_balance,
            "liabilities": snap.liabilities,
            "active_credits": snap.active_credits,
            "source": snap.source,
            "confirmed": snap.confirmed,
            "updated_at": snap.updated_at,
            "currency": getattr(snap, "currency", None) or "RUB",
        }

    workflow_out = None
    if wf is not None:
        workflow_out = {
            "id": wf.id,
            "workflow_type": wf.workflow_type,
            "status": wf.status,
            "current_step": wf.current_step,
            "started_at": wf.started_at,
            "finished_at": wf.finished_at,
            "context": wf.context or {},
            "result": wf.result,
        }

    decisions = sorted(app.decisions or [], key=lambda d: d.created_at or d.id, reverse=True)
    offers = sorted(app.offers or [], key=lambda o: o.created_at or o.id, reverse=True)

    return {
        "application": application,
        "company": company_out,
        "financials": financials,
        "workflow": workflow_out,
        "checks_summary": _checks_summary(app),
        "open_document_requests": open_reqs,
        "decisions": [
            {
                "id": d.id,
                "decision_type": d.decision_type,
                "score": d.score,
                "reason_codes": d.reason_codes or [],
                "explanation": d.explanation,
                "created_at": d.created_at,
            }
            for d in decisions
        ],
        "offers": [
            {
                "id": o.id,
                "amount": o.amount,
                "term_months": o.term_months,
                "rate": o.rate,
                "monthly_payment": o.monthly_payment,
                "status": o.status,
                "expires_at": o.expires_at,
                "conditions": o.conditions or {},
            }
            for o in offers
        ],
        "allowed_actions": _allowed_actions(app.status),
    }


def build_analyst_checks(app: CreditApplication) -> dict[str, Any]:
    checks = analyst_visible_checks(app)
    return {
        "application_id": app.id,
        "status": app.status,
        "summary": _checks_summary(app),
        "checks": [serialize_check(c, include_internal=True) for c in checks],
    }
