from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import Field

from app.core.enums import GoalType, LegalForm, ProductType, ScheduleType
from app.schemas.common import APIModel

class FeeOut(APIModel):
    name: str
    type: str
    value: Decimal

class CreditProductOut(APIModel):
    id: str
    name: str
    type: ProductType
    description: str
    amount_min: Decimal
    amount_max: Decimal
    term_min: int
    term_max: int
    rate_min: Decimal
    rate_max: Decimal
    collateral_required: bool
    legal_forms: list[LegalForm]
    min_business_age_months: int
    suitable_goals: list[GoalType]
    documents: list[str]
    fees: list[FeeOut]
    schedule_types: list[ScheduleType]

class RecommendationsRequest(APIModel):
    company_id: str
    business_goal_id: str | None = None
    amount: Decimal | None = None
    term_months: int | None = None

class CreditRecommendationOut(APIModel):
    product_id: str
    product_type: ProductType
    product_name: str
    match_score: float
    eligible_by_basic_rules: bool
    estimated_monthly_payment: Decimal
    estimated_rate: Decimal
    recommended_amount: Decimal
    recommended_term: int
    reasons: list[str]
    warnings: list[str]

class RecommendationsResponse(APIModel):
    company_id: str
    business_goal: GoalType
    requested_amount: Decimal
    currency: str = "RUB"
    recommendations: list[CreditRecommendationOut]
    is_official_offer: bool = False
    model_version: str = "demo-rules-v1"

class CalculateRequest(APIModel):
    amount: Decimal = Field(gt=0)
    term_months: int = Field(ge=1, le=360)
    annual_rate: Decimal = Field(ge=0, le=100)
    schedule_type: ScheduleType = ScheduleType.ANNUITY
    start_date: date | None = None
    fees_percent: Decimal = Decimal("0")
    fees_fixed: Decimal = Decimal("0")
    product_id: str | None = None

class PaymentRowOut(APIModel):
    month: int
    date: date
    payment: Decimal
    principal: Decimal
    interest: Decimal
    fees: Decimal
    balance: Decimal

class PaymentScheduleOut(APIModel):
    schedule_type: ScheduleType
    amount: Decimal
    term_months: int
    annual_rate: Decimal
    monthly_payment: Decimal
    total_payment: Decimal
    total_interest: Decimal
    total_fees: Decimal
    rows: list[PaymentRowOut]

class ScenarioParamsIn(APIModel):
    amount: Decimal
    term_months: int
    annual_rate: Decimal
    schedule_type: ScheduleType = ScheduleType.ANNUITY
    disbursement_date: date
    repayment_start_date: date
    revenue_change_pct: Decimal = Decimal("0")
    expense_change_pct: Decimal = Decimal("0")
    one_time_investment: Decimal = Decimal("0")
    own_funds: Decimal = Decimal("0")
    seasonal_swing_pct: Decimal = Decimal("0")
    base_monthly_revenue: Decimal
    base_monthly_expenses: Decimal

class ScenarioRequest(APIModel):
    company_id: str
    name: str = "Базовый"
    params: ScenarioParamsIn
    persist: bool = True

class ScenarioSeriesPoint(APIModel):
    month: int
    balance: Decimal
    payment: Decimal
    net_flow: Decimal

class ScenarioResultOut(APIModel):
    id: str
    name: str
    params: ScenarioParamsIn
    monthly_payment: Decimal
    cash_flow_after_payment: Decimal
    min_balance: Decimal
    deficit_months: list[int]
    explanation: str
    series: list[ScenarioSeriesPoint]
    created_at: str

class ReadinessRequest(APIModel):
    company_id: str
    product_id: str | None = None
    application_id: str | None = None

class ReadinessFactorOut(APIModel):
    key: str
    label: str
    weight: int
    score: float
    max_score: float
    missing: list[str]
    recommendations: list[str]

class ReadinessResultOut(APIModel):
    score: int
    factors: list[ReadinessFactorOut]
    version: str
    updated_at: str

class ProjectEvaluateRequest(APIModel):
    initial_investment: Decimal
    own_funds: Decimal = Decimal("0")
    credit_amount: Decimal
    additional_sales: Decimal
    variable_costs: Decimal
    fixed_costs: Decimal
    tax_rate: Decimal = Decimal("0")
    horizon_months: int = Field(ge=1, le=240)
    residual_value: Decimal = Decimal("0")
    discount_rate: Decimal = Decimal("12")
    credit_rate: Decimal
    credit_term_months: int

class ProjectCashFlowRow(APIModel):
    month: int
    cf: Decimal
    cumulative: Decimal
    discounted: Decimal

class ProjectEvaluateOut(APIModel):
    simple_payback_months: int | None
    discounted_payback_months: int | None
    npv: Decimal
    irr: Decimal | None
    roi: Decimal
    break_even_units: Decimal | None
    cash_flows: list[ProjectCashFlowRow]
