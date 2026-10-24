from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import Field

from app.core.enums import GoalType, LegalForm, ProductStatus, ProductType, ScheduleType
from app.core.money import Money
from app.schemas.common import APIModel

CATALOG_VERSION = "catalog-v1"


class FeeOut(APIModel):
    name: str
    type: str
    value: Money


class CreditProductRuleOut(APIModel):
    id: str
    rule_type: str
    parameters: dict = {}
    version: str = "demo-rules-v1"


class CreditProductListItem(APIModel):
    id: str
    code: str | None = None
    name: str
    type: ProductType
    description: str
    amount_min: Money
    amount_max: Money
    term_min: int
    term_max: int
    rate_min: Money
    rate_max: Money
    collateral_required: bool
    legal_forms: list[LegalForm]
    suitable_goals: list[GoalType]
    status: ProductStatus
    version: int = 1
    currency: str = "RUB"


class CreditProductOut(APIModel):
    id: str
    code: str | None = None
    name: str
    type: ProductType
    description: str
    amount_min: Money
    amount_max: Money
    term_min: int
    term_max: int
    rate_min: Money
    rate_max: Money
    collateral_required: bool
    legal_forms: list[LegalForm]
    min_business_age_months: int
    suitable_goals: list[GoalType]
    documents: list[str]
    fees: list[FeeOut]
    schedule_types: list[ScheduleType]
    features: list = []
    eligibility_rules: dict = {}
    rules: list[CreditProductRuleOut] = []
    status: ProductStatus = ProductStatus.PUBLISHED
    version: int = 1
    catalog_version: str = CATALOG_VERSION
    currency: str = "RUB"


class CreditProductCatalogOut(APIModel):
    catalog_version: str = CATALOG_VERSION
    items: list[CreditProductListItem]


class RecommendationsRequest(APIModel):
    company_id: str
    business_goal_id: str | None = None
    amount: Money | None = None
    term_months: int | None = None


class CreditRecommendationOut(APIModel):
    product_id: str
    product_type: ProductType
    product_name: str
    match_score: Money
    eligible_by_basic_rules: bool
    estimated_monthly_payment: Money
    estimated_rate: Money
    recommended_amount: Money
    recommended_term: int
    reasons: list[str]
    warnings: list[str]


class RecommendationsResponse(APIModel):
    company_id: str
    business_goal: GoalType
    requested_amount: Money
    currency: str = "RUB"
    recommendations: list[CreditRecommendationOut]
    is_official_offer: bool = False
    model_version: str = "demo-rules-v1"


class CalculateRequest(APIModel):
    amount: Money = Field(gt=0)
    term_months: int = Field(ge=1, le=360)
    annual_rate: Money = Field(ge=0, le=100)
    schedule_type: ScheduleType = ScheduleType.ANNUITY
    start_date: date | None = None
    fees_percent: Money = Decimal("0")
    fees_fixed: Money = Decimal("0")
    product_id: str | None = None
    currency: str = "RUB"


class PaymentRowOut(APIModel):
    month: int
    date: date
    payment: Money
    principal: Money
    interest: Money
    fees: Money
    balance: Money


class PaymentScheduleOut(APIModel):
    schedule_type: ScheduleType
    amount: Money
    term_months: int
    annual_rate: Money
    monthly_payment: Money
    total_payment: Money
    total_interest: Money
    total_fees: Money
    rows: list[PaymentRowOut]
    currency: str = "RUB"


class ScenarioParamsIn(APIModel):
    amount: Money
    term_months: int
    annual_rate: Money
    schedule_type: ScheduleType = ScheduleType.ANNUITY
    disbursement_date: date
    repayment_start_date: date
    revenue_change_pct: Money = Decimal("0")
    expense_change_pct: Money = Decimal("0")
    one_time_investment: Money = Decimal("0")
    own_funds: Money = Decimal("0")
    seasonal_swing_pct: Money = Decimal("0")
    base_monthly_revenue: Money
    base_monthly_expenses: Money


class ScenarioRequest(APIModel):
    company_id: str
    name: str = "Базовый"
    params: ScenarioParamsIn
    persist: bool = True


class ScenarioSeriesPoint(APIModel):
    month: int
    balance: Money
    payment: Money
    net_flow: Money


class ScenarioResultOut(APIModel):
    id: str
    name: str
    params: ScenarioParamsIn
    monthly_payment: Money
    cash_flow_after_payment: Money
    min_balance: Money
    deficit_months: list[int]
    explanation: str
    series: list[ScenarioSeriesPoint]
    created_at: str
    currency: str = "RUB"


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
    initial_investment: Money
    own_funds: Money = Decimal("0")
    credit_amount: Money
    additional_sales: Money
    variable_costs: Money
    fixed_costs: Money
    tax_rate: Money = Decimal("0")
    horizon_months: int = Field(ge=1, le=240)
    residual_value: Money = Decimal("0")
    discount_rate: Money = Decimal("12")
    credit_rate: Money
    credit_term_months: int
    currency: str = "RUB"


class ProjectCashFlowRow(APIModel):
    month: int
    cf: Money
    cumulative: Money
    discounted: Money


class ProjectEvaluateOut(APIModel):
    simple_payback_months: int | None
    discounted_payback_months: int | None
    npv: Money
    irr: Money | None
    roi: Money
    break_even_units: Money | None
    cash_flows: list[ProjectCashFlowRow]
    currency: str = "RUB"
