from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.core.enums import ApplicationStatus, UserRole
from app.deps import CurrentUser, DbDep
from app.schemas.analyst import (
    AnalystApplicationCard,
    AnalystCheckOut,
    AnalystChecksOut,
    AnalystChecksSummary,
    AnalystCompanyBrief,
    AnalystDecisionBrief,
    AnalystFinancialsBrief,
    AnalystOfferBrief,
    AnalystQueueItem,
    AnalystQueueOut,
    AnalystWorkflowBrief,
)
from app.schemas.application import ApplicationOut, DocumentRequestOut
from app.services.access import require_application_access, require_roles
from app.services.analyst import (
    build_analyst_card,
    build_analyst_checks,
    get_analyst_application,
    list_analyst_queue,
)

router = APIRouter(prefix="/analyst", tags=["analyst"])


@router.get("/applications", response_model=AnalystQueueOut)
def analyst_applications_queue(
    db: DbDep,
    user: CurrentUser,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    product_id: str | None = None,
    assigned_to_me: bool = False,
    unassigned: bool = False,
    q: str | None = Query(default=None, description="Поиск по названию/ИНН/продукту/id"),
    include_closed: bool = Query(default=False, description="Включить REJECTED/ISSUED"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AnalystQueueOut:
    require_roles(user, UserRole.ANALYST)
    items, total, counts = list_analyst_queue(
        db,
        user=user,
        status_filter=status_filter,
        product_id=product_id,
        assigned_to_me=assigned_to_me,
        unassigned=unassigned,
        q=q,
        include_closed=include_closed,
        limit=limit,
        offset=offset,
    )
    return AnalystQueueOut(
        items=[AnalystQueueItem(**i) for i in items],
        total=total,
        counts_by_status=counts,
    )


@router.get("/applications/{application_id}", response_model=AnalystApplicationCard)
def analyst_application_card(
    application_id: str, db: DbDep, user: CurrentUser
) -> AnalystApplicationCard:
    require_roles(user, UserRole.ANALYST)
    app = get_analyst_application(db, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app)

    raw = build_analyst_card(db, app)
    return AnalystApplicationCard(
        application=ApplicationOut(**raw["application"]),
        company=AnalystCompanyBrief(**raw["company"]) if raw.get("company") else None,
        financials=AnalystFinancialsBrief(**raw["financials"]) if raw.get("financials") else None,
        workflow=AnalystWorkflowBrief(**raw["workflow"]) if raw.get("workflow") else None,
        checks_summary=AnalystChecksSummary(**raw["checks_summary"]),
        open_document_requests=[DocumentRequestOut(**r) for r in raw["open_document_requests"]],
        decisions=[AnalystDecisionBrief(**d) for d in raw["decisions"]],
        offers=[AnalystOfferBrief(**o) for o in raw["offers"]],
        allowed_actions=raw["allowed_actions"],
    )


@router.get("/applications/{application_id}/checks", response_model=AnalystChecksOut)
def analyst_application_checks(
    application_id: str, db: DbDep, user: CurrentUser
) -> AnalystChecksOut:
    require_roles(user, UserRole.ANALYST)
    app = get_analyst_application(db, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app)

    raw = build_analyst_checks(app)
    return AnalystChecksOut(
        application_id=raw["application_id"],
        status=raw["status"],
        summary=AnalystChecksSummary(**raw["summary"]),
        checks=[AnalystCheckOut(**c) for c in raw["checks"]],
    )
