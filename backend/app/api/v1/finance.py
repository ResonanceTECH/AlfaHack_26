from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from app.config import get_settings
from app.core.enums import TransactionCategory
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company
from app.models.credit import CreditProduct
from app.schemas.finance_p1 import (
    AssistantConversationCreate,
    AssistantConversationOut,
    AssistantMessageIn,
    AssistantMessageOut,
    AssistantStatusOut,
    CreditPassportOut,
    CreditReadinessOut,
    FinanceSeriesOut,
    FinanceSummaryOut,
    ForecastCreateIn,
    ForecastOut,
    ScenarioCreateIn,
    ScenarioOut,
    StatementAcceptedOut,
    StatementConfirmOut,
    StatementDetailOut,
    StatementListItem,
    TransactionOut,
    TransactionPatch,
    TransactionsAnalyticsOut,
)
from app.services.access import require_company_access
from app.services.ai_consultant import generate_reply
from app.services.audit import write_audit
from app.services.company_finance import (
    assistant_status,
    build_credit_passport,
    company_readiness,
    confirm_statement,
    create_conversation,
    create_forecast,
    create_scenario,
    finance_series,
    finance_summary,
    get_conversation,
    get_forecast,
    get_statement,
    import_statement_sync,
    list_conversations,
    list_messages,
    list_scenarios,
    list_statements,
    list_transactions,
    serialize_forecast,
    serialize_message,
    serialize_scenario,
    serialize_statement,
    serialize_tx,
    transactions_analytics,
)
from sqlalchemy import select

from app.models.finance import AiMessage, CreditScenario, Transaction

router = APIRouter(tags=["finance"])


def _company(db: DbDep, company_id: str) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    return company


# --- statements ---


@router.get("/companies/{company_id}/statements", response_model=list[StatementListItem])
def company_statements(company_id: str, db: DbDep, user: CurrentUser) -> list[StatementListItem]:
    require_company_access(db, user, company_id)
    return [StatementListItem(**s) for s in list_statements(db, company_id)]


@router.post(
    "/companies/{company_id}/statements",
    response_model=StatementAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_statement(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    file: UploadFile = File(...),
    period_start: date | None = Form(default=None),
    period_end: date | None = Form(default=None),
    source_label: str | None = Form(default=None),
) -> StatementAcceptedOut:
    require_company_access(db, user, company_id, write=True)
    settings = get_settings()
    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл слишком большой")
    filename = file.filename or "statement.csv"
    from app.services.statements import statement_extension_ok

    if not statement_extension_ok(filename):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Поддерживаются только CSV и XLSX",
        )
    upload_root = Path(settings.upload_dir) / "statements" / company_id
    upload_root.mkdir(parents=True, exist_ok=True)
    stmt_id = str(uuid4())
    dest = upload_root / f"{stmt_id}_{Path(filename).name}"
    dest.write_bytes(content)

    st = import_statement_sync(
        db,
        company_id=company_id,
        content=content,
        filename=filename,
        file_path=str(dest),
        period_start=period_start,
        period_end=period_end,
        source_label=source_label,
    )
    # keep generated id from model; file already written with temp id — rename optional
    write_audit(
        db,
        actor_id=user.id,
        entity_type="financial_statement",
        entity_id=st.id,
        action="statement_upload",
        details={"status": st.status.value, "file": filename},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return StatementAcceptedOut(
        statement_id=st.id,
        id=st.id,
        processing_status=st.status,
    )


@router.get(
    "/companies/{company_id}/statements/{statement_id}",
    response_model=StatementDetailOut,
)
def company_statement_detail(
    company_id: str, statement_id: str, db: DbDep, user: CurrentUser
) -> StatementDetailOut:
    require_company_access(db, user, company_id)
    st = get_statement(db, company_id, statement_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Выписка не найдена")
    return StatementDetailOut(**serialize_statement(st))


@router.post(
    "/companies/{company_id}/statements/{statement_id}/confirm",
    response_model=StatementConfirmOut,
)
def company_statement_confirm(
    company_id: str,
    statement_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> StatementConfirmOut:
    require_company_access(db, user, company_id, write=True)
    st = get_statement(db, company_id, statement_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Выписка не найдена")
    confirm_statement(db, st)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="financial_statement",
        entity_id=st.id,
        action="statement_confirm",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return StatementConfirmOut(id=st.id, status=st.status)


# --- transactions ---


@router.get("/companies/{company_id}/transactions", response_model=list[TransactionOut])
def company_transactions(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    category: TransactionCategory | None = None,
    direction: str | None = None,
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TransactionOut]:
    require_company_access(db, user, company_id)
    rows = list_transactions(
        db,
        company_id,
        category=category,
        direction=direction,
        q=q,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return [TransactionOut(**serialize_tx(t)) for t in rows]


@router.patch(
    "/companies/{company_id}/transactions/{transaction_id}",
    response_model=TransactionOut,
)
def patch_transaction(
    company_id: str,
    transaction_id: str,
    body: TransactionPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> TransactionOut:
    require_company_access(db, user, company_id, write=True)
    tx = db.get(Transaction, transaction_id)
    if tx is None or tx.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Операция не найдена")
    patch = body.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(tx, k, v)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="transaction",
        entity_id=tx.id,
        action="transaction_patch",
        details=patch,
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    db.refresh(tx)
    return TransactionOut(**serialize_tx(tx))


@router.get(
    "/companies/{company_id}/transactions/analytics",
    response_model=TransactionsAnalyticsOut,
)
def company_tx_analytics(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    period: str = "6m",
) -> TransactionsAnalyticsOut:
    require_company_access(db, user, company_id)
    return TransactionsAnalyticsOut(**transactions_analytics(db, company_id, period=period))


# --- finance summary / series ---


@router.get("/companies/{company_id}/finance/summary", response_model=FinanceSummaryOut)
def company_finance_summary(
    company_id: str, db: DbDep, user: CurrentUser, period: str = "6m"
) -> FinanceSummaryOut:
    require_company_access(db, user, company_id)
    return FinanceSummaryOut(**finance_summary(db, company_id, period=period))


@router.get("/companies/{company_id}/finance/series", response_model=FinanceSeriesOut)
def company_finance_series(
    company_id: str, db: DbDep, user: CurrentUser, period: str = "12m"
) -> FinanceSeriesOut:
    require_company_access(db, user, company_id)
    return FinanceSeriesOut(**finance_series(db, company_id, period=period))


# --- forecasts / scenarios ---


@router.post(
    "/companies/{company_id}/finance/forecasts",
    response_model=ForecastOut,
    status_code=status.HTTP_201_CREATED,
)
def company_create_forecast(
    company_id: str,
    body: ForecastCreateIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> ForecastOut:
    require_company_access(db, user, company_id)
    result = create_forecast(
        db,
        company_id,
        horizon_days=body.horizon_days,
        include_uncertainty=body.include_uncertainty,
        planned_payments=body.planned_payments,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="cashflow_forecast",
        entity_id=result["id"],
        action="forecast_create",
        details={"horizon_days": body.horizon_days},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return ForecastOut(**result)


@router.get(
    "/companies/{company_id}/finance/forecasts/{forecast_id}",
    response_model=ForecastOut,
)
def company_get_forecast(
    company_id: str, forecast_id: str, db: DbDep, user: CurrentUser
) -> ForecastOut:
    require_company_access(db, user, company_id)
    fc = get_forecast(db, company_id, forecast_id)
    if fc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогноз не найден")
    return ForecastOut(**serialize_forecast(fc))


@router.post(
    "/companies/{company_id}/finance/scenarios",
    response_model=ScenarioOut,
    status_code=status.HTTP_201_CREATED,
)
def company_create_scenario(
    company_id: str,
    body: ScenarioCreateIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> ScenarioOut:
    require_company_access(db, user, company_id)
    sc = create_scenario(db, company_id, body.model_dump())
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_scenario",
        entity_id=sc.id,
        action="scenario_create",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return ScenarioOut(**serialize_scenario(sc))


@router.get("/companies/{company_id}/finance/scenarios", response_model=list[ScenarioOut])
def company_list_scenarios(
    company_id: str, db: DbDep, user: CurrentUser
) -> list[ScenarioOut]:
    require_company_access(db, user, company_id)
    return [ScenarioOut(**serialize_scenario(s)) for s in list_scenarios(db, company_id)]


@router.get(
    "/companies/{company_id}/finance/scenarios/{scenario_id}",
    response_model=ScenarioOut,
)
def company_get_scenario(
    company_id: str, scenario_id: str, db: DbDep, user: CurrentUser
) -> ScenarioOut:
    require_company_access(db, user, company_id)
    sc = db.get(CreditScenario, scenario_id)
    if sc is None or sc.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сценарий не найден")
    return ScenarioOut(**serialize_scenario(sc))


# --- credit passport / readiness ---


@router.get("/companies/{company_id}/credit-passport", response_model=CreditPassportOut)
def company_credit_passport(
    company_id: str, db: DbDep, user: CurrentUser
) -> CreditPassportOut:
    require_company_access(db, user, company_id)
    company = _company(db, company_id)
    return CreditPassportOut(**build_credit_passport(db, company))


@router.post(
    "/companies/{company_id}/credit-passport/refresh",
    response_model=CreditPassportOut,
)
def company_credit_passport_refresh(
    company_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> CreditPassportOut:
    require_company_access(db, user, company_id)
    company = _company(db, company_id)
    passport = build_credit_passport(db, company)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_passport",
        entity_id=company_id,
        action="passport_refresh",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return CreditPassportOut(**passport)


@router.get("/companies/{company_id}/credit-readiness", response_model=CreditReadinessOut)
def company_credit_readiness(
    company_id: str, db: DbDep, user: CurrentUser
) -> CreditReadinessOut:
    require_company_access(db, user, company_id)
    company = _company(db, company_id)
    return CreditReadinessOut(**company_readiness(db, company))


# --- assistant ---


@router.get("/assistant/status", response_model=AssistantStatusOut)
def get_assistant_status(db: DbDep, user: CurrentUser) -> AssistantStatusOut:
    _ = user
    return AssistantStatusOut(**assistant_status(db))


@router.get(
    "/companies/{company_id}/assistant/conversations",
    response_model=list[AssistantConversationOut],
)
def assistant_list_conversations(
    company_id: str, db: DbDep, user: CurrentUser
) -> list[AssistantConversationOut]:
    require_company_access(db, user, company_id)
    return [
        AssistantConversationOut(id=c.id, company_id=c.company_id, title=c.title, created_at=c.created_at)
        for c in list_conversations(db, company_id, user.id)
    ]


@router.post(
    "/companies/{company_id}/assistant/conversations",
    response_model=AssistantConversationOut,
    status_code=status.HTTP_201_CREATED,
)
def assistant_create_conversation(
    company_id: str,
    body: AssistantConversationCreate,
    db: DbDep,
    user: CurrentUser,
) -> AssistantConversationOut:
    require_company_access(db, user, company_id, write=True)
    conv = create_conversation(db, company_id=company_id, user_id=user.id, title=body.title)
    db.commit()
    return AssistantConversationOut(
        id=conv.id, company_id=conv.company_id, title=conv.title, created_at=conv.created_at
    )


@router.get(
    "/companies/{company_id}/assistant/conversations/{conversation_id}/messages",
    response_model=list[AssistantMessageOut],
)
def assistant_list_messages(
    company_id: str, conversation_id: str, db: DbDep, user: CurrentUser
) -> list[AssistantMessageOut]:
    require_company_access(db, user, company_id)
    conv = get_conversation(db, company_id, conversation_id, user.id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Диалог не найден")
    return [AssistantMessageOut(**serialize_message(m)) for m in list_messages(db, conversation_id)]


@router.post(
    "/companies/{company_id}/assistant/conversations/{conversation_id}/messages",
    response_model=AssistantMessageOut,
)
def assistant_post_message(
    company_id: str,
    conversation_id: str,
    body: AssistantMessageIn,
    db: DbDep,
    user: CurrentUser,
) -> AssistantMessageOut:
    require_company_access(db, user, company_id, write=True)
    conv = get_conversation(db, company_id, conversation_id, user.id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Диалог не найден")

    db.add(AiMessage(conversation_id=conv.id, role="user", content=body.content))
    products = list(
        db.scalars(select(CreditProduct).where(CreditProduct.is_active.is_(True))).all()
    )
    company = _company(db, company_id)
    reply = generate_reply(
        message=body.content,
        products=products,
        company_name=company.name,
    )
    assistant = AiMessage(
        conversation_id=conv.id,
        role="assistant",
        content=reply["content"],
        meta={
            "sources": reply.get("sources") or [],
            "suggested_actions": reply.get("suggested_actions") or [],
        },
    )
    db.add(assistant)
    db.commit()
    db.refresh(assistant)
    return AssistantMessageOut(**serialize_message(assistant))
