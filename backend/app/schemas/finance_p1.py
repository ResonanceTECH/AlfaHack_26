from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import Field

from app.core.enums import StatementStatus, TransactionCategory
from app.core.money import Money
from app.schemas.common import APIModel


class StatementListItem(APIModel):
    id: str
    company_id: str
    period_from: date | None = None
    period_to: date | None = None
    source_type: str = "UPLOAD"
    source_label: str | None = None
    file_name: str | None = None
    status: StatementStatus
    processing_status: StatementStatus | None = None
    tx_count: int = 0
    error_message: str | None = None
    uploaded_at: datetime | None = None
    processed_at: datetime | None = None


class StatementAcceptedOut(APIModel):
    statement_id: str
    processing_status: StatementStatus = StatementStatus.QUEUED
    id: str | None = None


class StatementDetailOut(StatementListItem):
    parsed_summary: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    structure: dict[str, Any] = Field(default_factory=dict)


class StatementConfirmOut(APIModel):
    id: str
    status: StatementStatus
    message: str = "Выписка подтверждена и включена в аналитику"


class TransactionOut(APIModel):
    id: str
    company_id: str
    statement_id: str | None = None
    date: date
    amount: Money
    currency: str = "RUB"
    direction: str
    category: TransactionCategory | str | None = None
    counterparty: str | None = None
    purpose: str | None = None
    description: str | None = None
    balance_after: Money | None = None


class TransactionPatch(APIModel):
    category: TransactionCategory | None = None
    purpose: str | None = None
    description: str | None = None


class TransactionsAnalyticsOut(APIModel):
    by_category: list[dict[str, Any]] = Field(default_factory=list)
    recurring: list[dict[str, Any]] = Field(default_factory=list)
    exclusions: dict[str, Any] = Field(default_factory=dict)
    period: str | None = None


class FinanceSummaryOut(APIModel):
    period: str
    currency: str = "RUB"
    revenue: Money
    inflow: Money
    outflow: Money
    net_cash_flow: Money
    cash_balance: Money
    liabilities: Money
    active_credits: Money
    debt_load: Money | None = None
    source: str = "aggregated"
    as_of: datetime | None = None
    statement_confirmed: bool = False


class FinanceSeriesPoint(APIModel):
    period: str
    inflow: Money
    outflow: Money
    net: Money
    cash_balance: Money | None = None


class FinanceSeriesOut(APIModel):
    period: str
    currency: str = "RUB"
    points: list[FinanceSeriesPoint] = Field(default_factory=list)
    source: str = "transactions"


class ForecastCreateIn(APIModel):
    horizon_days: int = Field(default=90, ge=30, le=180)
    include_uncertainty: bool = True
    planned_payments: list[dict] | None = None


class ForecastOut(APIModel):
    id: str
    status: str = "COMPLETED"
    currency: str = "RUB"
    horizon_days: int
    model: dict[str, Any] = Field(default_factory=dict)
    quality: dict[str, Any] = Field(default_factory=dict)
    points: list[dict[str, Any]] = Field(default_factory=list)
    cash_gaps: list[dict[str, Any]] = Field(default_factory=list)
    warning: str | None = None
    created_at: datetime | None = None


class ScenarioCreateIn(APIModel):
    name: str = Field(default="Сценарий", max_length=255)
    loan_amount: Money | None = None
    revenue_change_pct: float = 0
    expense_change_pct: float = 0
    stress: bool = False
    parameters: dict[str, Any] = Field(default_factory=dict)
    params: dict[str, Any] | None = None
    persist: bool = True


class ScenarioOut(APIModel):
    id: str
    company_id: str
    name: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    series: list[dict[str, Any]] = Field(default_factory=list)
    monthly_payment: Money | None = None
    cash_flow_after_payment: Money | None = None
    min_balance: Money | None = None
    deficit_months: list[int] = Field(default_factory=list)
    explanation: str | None = None
    created_at: datetime | None = None


class CreditPassportOut(APIModel):
    company_id: str
    refreshed_at: datetime
    sources: list[dict[str, Any]] = Field(default_factory=list)
    profile: dict[str, Any] = Field(default_factory=dict)
    financials: dict[str, Any] = Field(default_factory=dict)
    credit_exposure: dict[str, Any] = Field(default_factory=dict)
    applications_summary: dict[str, Any] = Field(default_factory=dict)
    disclaimer: str = (
        "Кредитный паспорт — агрегация демо-данных платформы, не бюро кредитных историй."
    )


class AssistantConversationOut(APIModel):
    id: str
    company_id: str
    title: str | None = None
    created_at: datetime | None = None


class AssistantConversationCreate(APIModel):
    title: str | None = Field(default=None, max_length=255)


class AssistantMessageIn(APIModel):
    content: str = Field(min_length=1, max_length=4000)


class AssistantMessageOut(APIModel):
    id: str
    role: str
    content: str
    sources: list[str] = Field(default_factory=list)
    suggested_actions: list[dict[str, str]] = Field(default_factory=list)
    created_at: datetime | None = None


class AssistantStatusOut(APIModel):
    ready: bool = True
    mode: str = "RULES_FALLBACK"
    model_active: str | None = None
    disclaimer: str = "Локальная модель опциональна; активен rule-based fallback."


class AgreementOut(APIModel):
    id: str
    application_id: str
    offer_id: str | None = None
    company_id: str
    number: str | None = None
    status: str
    amount: Money
    term_months: int
    rate: Money
    confirmed: bool = False
    confirmed_at: datetime | None = None
    document_ready: bool = True
    disclaimer: str = "Демонстрационный договор, не имеет юридической силы."


class AgreementConfirmIn(APIModel):
    acknowledged: bool = True
    note: str | None = None


class AgreementConfirmOut(APIModel):
    agreement_id: str
    status: str
    confirmed_at: datetime
    message: str = "Демонстрационное ознакомление зафиксировано"


class AuditEventOut(APIModel):
    id: str
    actor_id: str | None = None
    actor_login: str | None = None
    actor_role: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    company_id: str | None = None
    correlation_id: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime | None = None


class AuditEventListOut(APIModel):
    items: list[AuditEventOut]
    total: int = 0


class CreditReadinessOut(APIModel):
    company_id: str
    score: int
    max_score: int = 100
    checklist: list[dict[str, Any]] = Field(default_factory=list)
    factors: list[dict[str, Any]] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    version: str
    disclaimer: str = (
        "Индекс готовности данных — не вероятность одобрения и не скоринг банка."
    )
