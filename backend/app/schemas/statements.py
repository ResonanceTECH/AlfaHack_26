from __future__ import annotations

from datetime import date

from app.core.enums import TransactionCategory
from app.core.money import Money
from app.schemas.common import APIModel


class BankTransactionOut(APIModel):
    id: str
    date: date
    amount: Money
    direction: str
    counterparty: str
    purpose: str
    category: TransactionCategory
    balance: Money | None = None
    currency: str = "RUB"


class TransactionCategoryUpdate(APIModel):
    category: TransactionCategory


class StatementSummary(APIModel):
    total_inflow: Money
    total_outflow: Money
    net_cash_flow: Money
    excluded_internal_transfers: int
    recurring_payments: int
    currency: str = "RUB"


class MonthlyAgg(APIModel):
    month: str
    inflow: Money
    outflow: Money


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
    actual_balance: Money | None = None
    predicted_inflow: Money
    predicted_outflow: Money
    net_cash_flow: Money
    closing_balance: Money
    lower_bound: Money
    upper_bound: Money


class CashflowForecastOut(APIModel):
    horizon_days: int
    points: list[ForecastPointOut]
    minimum_balance: Money
    cash_gap_amount: Money | None
    cash_gap_date: date | None
    data_quality: str
    model_version: str
    warning: str | None = None
    currency: str = "RUB"


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
