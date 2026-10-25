from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from app.core.enums import ApplicationStatus, UserRole
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.application import ApplicationComment
from app.schemas.analyst import (
    AnalystApplicationCard,
    AnalystCheckOut,
    AnalystChecksOut,
    AnalystChecksSummary,
    AnalystCompanyBrief,
    AnalystDecisionBrief,
    AnalystDocumentRequestCancel,
    AnalystDocumentRequestCreate,
    AnalystDocumentRequestResult,
    AnalystFinancialsBrief,
    AnalystOfferBrief,
    AnalystProposeIn,
    AnalystProposeOut,
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
from app.services.audit import write_audit
from app.services.decisions import propose_decision, serialize_offer
from app.services.documents import (
    cancel_document_request,
    create_document_request,
    serialize_document_request,
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


@router.get(
    "/applications/{application_id}/document-requests",
    response_model=list[DocumentRequestOut],
)
def analyst_list_document_requests(
    application_id: str, db: DbDep, user: CurrentUser
) -> list[DocumentRequestOut]:
    require_roles(user, UserRole.ANALYST)
    app = get_analyst_application(db, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app)
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    reqs = sorted(app.document_requests or [], key=lambda r: r.created_at or epoch, reverse=True)
    return [DocumentRequestOut(**serialize_document_request(r)) for r in reqs]


@router.post(
    "/applications/{application_id}/document-requests",
    response_model=AnalystDocumentRequestResult,
    status_code=status.HTTP_201_CREATED,
)
def analyst_create_document_request(
    application_id: str,
    body: AnalystDocumentRequestCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AnalystDocumentRequestResult:
    require_roles(user, UserRole.ANALYST)
    app = get_analyst_application(db, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)

    req = create_document_request(
        db,
        app=app,
        analyst=user,
        doc_type=body.doc_type,
        comment=body.comment,
        due_at=body.due_at,
    )
    db.add(
        ApplicationComment(
            application_id=app.id,
            author_id=user.id,
            author_name=user.full_name,
            author_role=user.role.value,
            text=body.comment or f"Запрошен документ: {body.doc_type}",
            is_internal=False,
        )
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="document_request",
        entity_id=req.id,
        action="create",
        details={"application_id": app.id, "doc_type": body.doc_type},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(req)
    app = get_analyst_application(db, application_id) or app
    return AnalystDocumentRequestResult(
        request=DocumentRequestOut(**serialize_document_request(req)),
        application_id=app.id,
        status=app.status,
        current_step=app.current_step,
    )


@router.post(
    "/applications/{application_id}/document-requests/{request_id}/cancel",
    response_model=AnalystDocumentRequestResult,
)
def analyst_cancel_document_request(
    application_id: str,
    request_id: str,
    body: AnalystDocumentRequestCancel,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AnalystDocumentRequestResult:
    require_roles(user, UserRole.ANALYST)
    app = get_analyst_application(db, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)

    req = cancel_document_request(
        db, app=app, analyst=user, request_id=request_id, reason=body.reason
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="document_request",
        entity_id=req.id,
        action="cancel",
        details={"application_id": app.id, "reason": body.reason},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(req)
    app = get_analyst_application(db, application_id) or app
    return AnalystDocumentRequestResult(
        request=DocumentRequestOut(**serialize_document_request(req)),
        application_id=app.id,
        status=app.status,
        current_step=app.current_step,
    )


@router.post(
    "/applications/{application_id}/propose",
    response_model=AnalystProposeOut,
)
def analyst_propose_decision(
    application_id: str,
    body: AnalystProposeIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AnalystProposeOut:
    require_roles(user, UserRole.ANALYST)
    app = get_analyst_application(db, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)

    _decision, offer, payload = propose_decision(
        db,
        app=app,
        analyst=user,
        decision_type=body.decision,
        reason_codes=body.reason_codes or None,
        explanation=body.explanation,
        comment=body.comment,
        offer_amount=body.offer_amount,
        offer_term_months=body.offer_term_months,
        offer_rate=body.offer_rate,
        product_id=body.product_id,
        offer_label=body.offer_label,
    )

    if body.comment or body.explanation:
        db.add(
            ApplicationComment(
                application_id=app.id,
                author_id=user.id,
                author_name=user.full_name,
                author_role=user.role.value,
                text=body.comment or body.explanation or "",
                is_internal=True,
            )
        )

    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="propose_decision",
        details={
            "decision": body.decision.value,
            "decision_id": payload["decision_id"],
            "offer_id": payload.get("offer_id"),
        },
        correlation_id=cid,
    )
    db.commit()

    offer_brief = None
    if offer is not None:
        raw_offer = serialize_offer(offer)
        offer_brief = AnalystOfferBrief(
            id=raw_offer["id"],
            amount=raw_offer["amount"],
            term_months=raw_offer["term_months"],
            rate=raw_offer["rate"],
            monthly_payment=raw_offer.get("monthly_payment"),
            status=raw_offer["status"],
            expires_at=raw_offer.get("expires_at"),
            conditions=raw_offer.get("conditions") or {},
        )

    return AnalystProposeOut(
        application_id=payload["application_id"],
        status=payload["status"],
        current_step=payload.get("current_step"),
        decision_id=payload["decision_id"],
        decision_type=payload["decision_type"],
        offer_id=payload.get("offer_id"),
        reason_codes=list(payload.get("reason_codes") or []),
        explanation=payload.get("explanation"),
        offer=offer_brief,
    )
