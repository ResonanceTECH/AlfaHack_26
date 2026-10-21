from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.credit import CreditProduct
from app.models.finance import (
    AiConversation,
    AiMessage,
    CashflowForecast,
    FinancialSnapshot,
    FinancialTransaction,
)
from app.schemas.statements import (
    AiChatRequest,
    AiChatResponse,
    BankTransactionOut,
    CashflowForecastOut,
    ForecastRequest,
    StatementImportResult,
    TransactionCategoryUpdate,
)
from app.core.jsonutil import jsonable
from app.services.access import require_company_access
from app.services.ai_consultant import generate_reply
from app.services.audit import write_audit
from app.services.forecast import build_cashflow_forecast
from app.services.statements import build_import_result, parse_statement_bytes

router = APIRouter(tags=["statements", "forecasts", "ai"])

@router.post("/statements/import", response_model=StatementImportResult)
async def import_statement(
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    company_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    require_company_access(db, user, company_id, write=True)
    content = await file.read()
    try:
        parsed = parse_statement_bytes(content, file.filename or "statement.csv")
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    result = build_import_result(company_id, parsed)
    inserted = 0
    tx_out: list[dict] = []

    for t in result["transactions"]:
        exists = db.scalar(
            select(FinancialTransaction).where(
                FinancialTransaction.company_id == company_id,
                FinancialTransaction.external_hash == t["external_hash"],
            )
        )
        if exists:
            tx_out.append(
                {
                    "id": exists.id,
                    "date": exists.date,
                    "amount": exists.amount,
                    "direction": exists.direction,
                    "counterparty": exists.counterparty,
                    "purpose": exists.purpose,
                    "category": exists.category,
                    "balance": exists.balance,
                }
            )
            continue

        row = FinancialTransaction(
            id=t["id"],
            company_id=company_id,
            date=t["date"],
            amount=t["amount"],
            direction=t["direction"],
            counterparty=t["counterparty"],
            purpose=t["purpose"],
            category=t["category"],
            balance=t.get("balance"),
            source="statement",
            external_hash=t["external_hash"],
        )
        db.add(row)
        inserted += 1
        tx_out.append(
            {
                k: t[k]
                for k in (
                    "id",
                    "date",
                    "amount",
                    "direction",
                    "counterparty",
                    "purpose",
                    "category",
                    "balance",
                )
            }
        )

    months = result["monthly"] or []
    avg_in = (
        sum((m["inflow"] for m in months), Decimal("0")) / len(months)
        if months
        else result["summary"]["total_inflow"]
    )
    avg_out = (
        sum((m["outflow"] for m in months), Decimal("0")) / len(months)
        if months
        else result["summary"]["total_outflow"]
    )
    period = result["period_to"].strftime("%Y-%m")

    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    if snap:
        snap.avg_monthly_revenue = avg_in
        snap.operating_expenses = avg_out
        snap.source = "statement"
        snap.period = period
        snap.confirmed = False
    else:
        db.add(
            FinancialSnapshot(
                company_id=company_id,
                period=period,
                avg_monthly_revenue=avg_in,
                operating_expenses=avg_out,
                cash_balance=Decimal("0"),
                liabilities=Decimal("0"),
                active_credits=Decimal("0"),
                source="statement",
                confirmed=False,
            )
        )

    write_audit(
        db,
        actor_id=user.id,
        entity_type="statement",
        entity_id=result["id"],
        action="import",
        details={"inserted": inserted, "filename": file.filename},
        correlation_id=cid,
    )
    db.commit()
    result["transactions"] = tx_out
    return result

@router.get("/companies/{company_id}/transactions", response_model=list[BankTransactionOut])
def list_transactions(company_id: str, db: DbDep, user: CurrentUser) -> list[FinancialTransaction]:
    require_company_access(db, user, company_id)
    return list(
        db.scalars(
            select(FinancialTransaction)
            .where(FinancialTransaction.company_id == company_id)
            .order_by(FinancialTransaction.date.desc())
        ).all()
    )

@router.patch("/transactions/{transaction_id}/category", response_model=BankTransactionOut)
def update_tx_category(
    transaction_id: str, body: TransactionCategoryUpdate, db: DbDep, user: CurrentUser
) -> FinancialTransaction:
    tx = db.get(FinancialTransaction, transaction_id)
    if tx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Операция не найдена")
    require_company_access(db, user, tx.company_id, write=True)
    tx.category = body.category
    db.commit()
    db.refresh(tx)
    return tx

@router.post("/forecasts/cashflow", response_model=CashflowForecastOut)
def forecast_cashflow(body: ForecastRequest, db: DbDep, user: CurrentUser) -> dict:
    require_company_access(db, user, body.company_id)
    txs = list(
        db.scalars(
            select(FinancialTransaction).where(FinancialTransaction.company_id == body.company_id)
        ).all()
    )
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
            horizon_days=result["horizon_days"],
            model_version=result["model_version"],
            data_quality=result["data_quality"],
            result=jsonable(result),
        )
    )
    db.commit()
    return result

@router.post("/ai/chat", response_model=AiChatResponse)
def ai_chat(body: AiChatRequest, db: DbDep, user: CurrentUser) -> dict:
    require_company_access(db, user, body.company_id)

    if body.conversation_id:
        conv = db.get(AiConversation, body.conversation_id)
        if (
            conv is None
            or conv.company_id != body.company_id
            or conv.user_id != user.id
        ):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Диалог не найден")
    else:
        conv = AiConversation(company_id=body.company_id, user_id=user.id)
        db.add(conv)
        db.flush()

    user_msg = AiMessage(conversation_id=conv.id, role="user", content=body.message)
    db.add(user_msg)

    products = list(db.scalars(select(CreditProduct).where(CreditProduct.is_active.is_(True))).all())
    from app.models.company import Company

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
        sources=reply.get("sources"),
        suggested_actions=reply.get("suggested_actions"),
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
            "sources": assistant.sources,
            "suggested_actions": assistant.suggested_actions,
        },
    }
