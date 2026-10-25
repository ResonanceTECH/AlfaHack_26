from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.core.enums import ApplicationStatus, DecisionType, LegalForm, OfferStatus, WorkflowStatus
from app.core.money import Money
from app.schemas.application import ApplicationOut, DocumentRequestOut
from app.schemas.common import APIModel


class AnalystQueueItem(APIModel):
    id: str
    application_number: str | None = None
    company_id: str
    company_name: str | None = None
    inn: str | None = None
    status: ApplicationStatus
    current_step: str | None = None
    product_id: str | None = None
    product_name: str | None = None
    amount: Money
    term_months: int
    rate: Money | None = None
    readiness_score: int = 0
    assigned_analyst_id: str | None = None
    assigned_analyst_name: str | None = None
    open_document_requests: int = 0
    submitted_at: datetime | None = None
    updated_at: datetime | None = None
    created_at: datetime | None = None


class AnalystQueueOut(APIModel):
    items: list[AnalystQueueItem]
    total: int = 0
    counts_by_status: dict[str, int] = {}


class AnalystCompanyBrief(APIModel):
    id: str
    inn: str
    name: str
    legal_form: LegalForm | str
    ogrn: str | None = None
    industry: str | None = None
    registration_date: date | None = None
    region: str | None = None
    employees_count: int = 0
    registry_status: str = "ACTIVE"
    version: int = 1


class AnalystFinancialsBrief(APIModel):
    id: str
    company_id: str
    period: str | None = None
    avg_monthly_revenue: Money | None = None
    operating_expenses: Money | None = None
    cash_balance: Money | None = None
    liabilities: Money | None = None
    active_credits: Money | None = None
    source: str | None = None
    confirmed: bool = False
    updated_at: datetime | None = None
    currency: str = "RUB"


class AnalystWorkflowBrief(APIModel):
    id: str
    workflow_type: str
    status: WorkflowStatus | str
    current_step: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    context: dict = Field(default_factory=dict)
    result: dict | None = None


class AnalystChecksSummary(APIModel):
    total: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_audience: dict[str, int] = Field(default_factory=dict)
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    internal_count: int = 0


class AnalystDecisionBrief(APIModel):
    id: str
    decision_type: DecisionType | str
    score: int | None = None
    reason_codes: list[str] = Field(default_factory=list)
    explanation: str | None = None
    created_at: datetime | None = None


class AnalystOfferBrief(APIModel):
    id: str
    amount: Money
    term_months: int
    rate: Money
    monthly_payment: Money | None = None
    status: OfferStatus | str
    expires_at: datetime | None = None
    conditions: dict = Field(default_factory=dict)


class AnalystApplicationCard(APIModel):
    application: ApplicationOut
    company: AnalystCompanyBrief | None = None
    financials: AnalystFinancialsBrief | None = None
    workflow: AnalystWorkflowBrief | None = None
    checks_summary: AnalystChecksSummary = Field(default_factory=AnalystChecksSummary)
    open_document_requests: list[DocumentRequestOut] = Field(default_factory=list)
    decisions: list[AnalystDecisionBrief] = Field(default_factory=list)
    offers: list[AnalystOfferBrief] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)


class AnalystCheckOut(APIModel):
    id: str
    check_key: str
    status: str
    score: int | None = None
    reason_codes: list[str] = Field(default_factory=list)
    explanation: str | None = None
    created_at: datetime | None = None
    audience: str | None = None
    workflow_id: str | None = None
    payload: dict = Field(default_factory=dict)


class AnalystChecksOut(APIModel):
    application_id: str
    status: ApplicationStatus
    summary: AnalystChecksSummary = Field(default_factory=AnalystChecksSummary)
    checks: list[AnalystCheckOut] = Field(default_factory=list)


class AnalystDocumentRequestCreate(APIModel):
    doc_type: str = Field(min_length=1, max_length=64)
    comment: str | None = None
    due_at: datetime | None = None


class AnalystCommentCreate(APIModel):
    text: str = Field(min_length=1, max_length=4000)
    is_internal: bool = False


class AnalystDocumentRequestCancel(APIModel):
    reason: str | None = None


class AnalystDocumentRequestResult(APIModel):
    request: DocumentRequestOut
    application_id: str
    status: ApplicationStatus
    current_step: str | None = None


class AnalystProposeIn(APIModel):
    decision: DecisionType
    reason_codes: list[str] = Field(default_factory=list)
    explanation: str | None = None
    comment: str | None = None
    # параметры offer (APPROVED / COUNTEROFFERED)
    offer_amount: Money | None = Field(default=None, gt=0)
    offer_term_months: int | None = Field(default=None, ge=1, le=360)
    offer_rate: Money | None = None
    product_id: str | None = None
    offer_label: str | None = None


class AnalystProposeOut(APIModel):
    application_id: str
    status: ApplicationStatus
    current_step: str | None = None
    decision_id: str
    decision_type: DecisionType | str
    offer_id: str | None = None
    reason_codes: list[str] = Field(default_factory=list)
    explanation: str | None = None
    offer: AnalystOfferBrief | None = None
