from __future__ import annotations

from datetime import datetime

from app.core.enums import ApplicationStatus, LegalForm
from app.core.money import Money
from app.schemas.common import APIModel


class DashboardKpi(APIModel):
    period: str | None = None
    avg_monthly_revenue: Money | None = None
    operating_expenses: Money | None = None
    cash_balance: Money | None = None
    liabilities: Money | None = None
    active_credits: Money | None = None
    net_cashflow: Money | None = None
    applications_total: int = 0
    applications_active: int = 0
    unread_notifications: int = 0
    open_tasks: int = 0
    currency: str = "RUB"


class DashboardApplicationItem(APIModel):
    id: str
    status: ApplicationStatus
    product_id: str | None = None
    product_name: str | None = None
    amount: Money
    term_months: int
    readiness_score: int | None = None
    updated_at: datetime | None = None


class DashboardTaskItem(APIModel):
    id: str
    type: str
    title: str
    priority: str = "MEDIUM"
    application_id: str | None = None
    due_at: datetime | None = None
    meta: dict = {}


class DashboardNotificationItem(APIModel):
    id: str
    type: str
    title: str
    body: str | None = None
    is_read: bool = False
    created_at: datetime | None = None
    payload: dict = {}


class DashboardRecommendationItem(APIModel):
    product_id: str
    product_name: str
    score: float
    reason: str
    amount_hint: Money | None = None


class DashboardCompanyBrief(APIModel):
    id: str
    name: str
    inn: str
    legal_form: LegalForm
    registry_status: str
    region: str


class CompanyDashboardOut(APIModel):
    company: DashboardCompanyBrief
    kpi: DashboardKpi
    applications: list[DashboardApplicationItem]
    tasks: list[DashboardTaskItem]
    notifications: list[DashboardNotificationItem]
    recommendations: list[DashboardRecommendationItem]
    generated_at: datetime
