"""Legacy endpoints (deprecated). Новые — /companies/{id}/statements|finance|* в finance.py."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from app.core.jsonutil import jsonable
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company
from app.models.credit import CreditProduct
from app.models.finance import AiConversation, AiMessage, CashflowForecast, FinancialSnapshot, Transaction
from app.schemas.statements import (
    AiChatRequest,
    AiChatResponse,
    CashflowForecastOut,
    ForecastRequest,
    StatementImportResult,
)
from app.services.access import require_company_access
from app.services.ai_consultant import generate_reply
from app.services.audit import write_audit
from app.services.company_finance import import_statement_sync
from app.services.forecast import build_cashflow_forecast

router = APIRouter(tags=["statements-legacy"])


@router.post("/statements/import", response_model=StatementImportResult, deprecated=True)
async def import_statement_legacy(
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    company_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    require_company_access(db, user, company_id, write=True)
    content = await file.read()
    st = import_statement_sync(
        db,
        company_id=company_id,
        content=content,
        filename=file.filename or "statement.csv",
        file_path=None,
        period_start=None,
        period_end=None,
        source_label=None,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="statement",
        entity_id=st.id,
        action="import_legacy",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    summary = (st.parsed_summary or {}).get("summary") or {}
    txs = list(db.scalars(select(Transaction).where(Transaction.statement_id == st.id)).all())
    return {
        "id": st.id,
        "period_from": st.period_from,
        "period_to": st.period_to,
        "transactions": [
            {
                "id": t.id,
                "date": t.date,
                "amount": t.amount,
                "direction": t.direction,
                "counterparty": t.counterparty or "",
                "purpose": t.purpose or "",
                "category": t.category,
                "balance": t.balance_after,
            }
            for t in txs
        ],
        "summary": {
            "total_inflow": Decimal(str(summary.get("total_inflow", "0"))),
            "total_outflow": Decimal(str(summary.get("total_outflow", "0"))),
            "net_cash_flow": Decimal(str(summary.get("net_cash_flow", "0"))),
            "excluded_internal_transfers": int(summary.get("excluded_internal_transfers") or 0),
            "recurring_payments": int(summary.get("recurring_payments") or 0),
        },
        "monthly": (st.parsed_summary or {}).get("monthly") or [],
    }


@router.post("/forecasts/cashflow", response_model=CashflowForecastOut, deprecated=True)
def forecast_cashflow_legacy(body: ForecastRequest, db: DbDep, user: CurrentUser) -> dict:
    require_company_access(db, user, body.company_id)
    txs = list(db.scalars(select(Transaction).where(Transaction.company_id == body.company_id)).all())
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == body.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    cash = Decimal(str(snap.cash_balance)) if snap else Decimal("0")
    result = build_cashflow_forecast(
        transactions=txs,
        cash_balance=cash,
        horizon_days=body.horizon_days,
        planned_payments=body.planned_payments,
        company_id=body.company_id,
    )
    db.add(
        CashflowForecast(
            company_id=body.company_id,
            horizon_months=max(1, body.horizon_days // 30),
            model_version=result.get("model_version"),
            points=jsonable(result.get("points") or []),
            assumptions={"horizon_days": body.horizon_days, "status": "COMPLETED"},
            disclaimer=result.get("warning"),
        )
    )
    db.commit()
    return result


@router.post("/ai/chat", response_model=AiChatResponse, deprecated=True)
def ai_chat_legacy(body: AiChatRequest, db: DbDep, user: CurrentUser) -> dict:
    require_company_access(db, user, body.company_id)
    if body.conversation_id:
        conv = db.get(AiConversation, body.conversation_id)
        if conv is None or conv.company_id != body.company_id or conv.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Диалог не найден")
    else:
        conv = AiConversation(company_id=body.company_id, user_id=user.id, title="Legacy chat")
        db.add(conv)
        db.flush()

    db.add(AiMessage(conversation_id=conv.id, role="user", content=body.message))
    products = list(db.scalars(select(CreditProduct).where(CreditProduct.is_active.is_(True))).all())
    company = db.get(Company, body.company_id)
    reply = generate_reply(
        message=body.message,
        products=products,
        company_name=company.name if company else None,
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
    return {
        "conversation_id": conv.id,
        "message": {
            "id": assistant.id,
            "role": "assistant",
            "content": assistant.content,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "sources": reply.get("sources"),
            "suggested_actions": reply.get("suggested_actions"),
        },
    }
