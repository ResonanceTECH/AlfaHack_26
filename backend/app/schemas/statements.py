from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.core.enums import TransactionCategory
from app.schemas.common import APIModel

class BankTransactionOut(APIModel):
    id: str
    date: date
    amount: Decimal
    direction: str
    counterparty: str
    purpose: str
    category: TransactionCategory
    balance: Decimal | None = None

class TransactionCategoryUpdate(APIModel):
    category: TransactionCategory

class StatementSummary(APIModel):
    total_inflow: Decimal
    total_outflow: Decimal
    net_cash_flow: Decimal
    excluded_internal_transfers: int
    recurring_payments: int

class MonthlyAgg(APIModel):
    month: str
    inflow: Decimal
    outflow: Decimal

class StatementImportResult(APIModel):
    id: str
    period_from: date
    period_to: date
    transactions: list[BankTransactionOut]
    summary: StatementSummary
    monthly: list[MonthlyAgg]

class ForecastRequest(APIModel):
    company_id: str
    horizon_days: int = 90
    planned_payments: list[dict] | None = None

class ForecastPointOut(APIModel):
    date: date
    actual_balance: Decimal | None = None
    predicted_inflow: Decimal
    predicted_outflow: Decimal
    net_cash_flow: Decimal
    closing_balance: Decimal
    lower_bound: Decimal
    upper_bound: Decimal

class CashflowForecastOut(APIModel):
    horizon_days: int
    points: list[ForecastPointOut]
    minimum_balance: Decimal
    cash_gap_amount: Decimal | None
    cash_gap_date: date | None
    data_quality: str
    model_version: str
    warning: str | None = None

class AiChatRequest(APIModel):
    company_id: str
    message: str
    conversation_id: str | None = None

class AiSuggestedAction(APIModel):
    label: str
    path: str

class AiChatMessageOut(APIModel):
    id: str
    role: str
    content: str
    created_at: str
    sources: list[str] | None = None
    suggested_actions: list[AiSuggestedAction] | None = None

class AiChatResponse(APIModel):
    conversation_id: str
    message: AiChatMessageOut
