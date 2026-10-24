from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.core.enums import ApplicationStatus, DecisionType, GoalType, OfferStatus, ProductType, UserRole
from app.core.money import Money
from app.schemas.common import APIModel


class DocumentOut(APIModel):
    id: str
    type: str
    name: str
    size: int
    uploaded_at: datetime
    status: str


class DocumentMetaOut(APIModel):
    id: str
    doc_type: str
    type: str
    name: str
    file_name: str | None = None
    size: int = 0
    mime_type: str | None = None
    status: str
    uploaded_at: datetime | None = None
    review_status: str | None = None


class RequiredDocumentSlot(APIModel):
    doc_type: str
    label: str
    required: bool = True
    status: str
    document_id: str | None = None


class ApplicationDocumentsOut(APIModel):
    application_id: str
    required: list[RequiredDocumentSlot] = []
    documents: list[DocumentMetaOut] = []


class DocumentRequestOut(APIModel):
    id: str
    doc_type: str
    label: str | None = None
    comment: str | None = None
    status: str
    due_at: datetime | None = None
    created_at: datetime | None = None
    satisfied_document_id: str | None = None


class DocumentRequestRespondIn(APIModel):
    document_ids: list[str] = Field(default_factory=list)
    comment: str | None = None


class CommentOut(APIModel):
    id: str
    author_id: str | None
    author_name: str
    author_role: UserRole | str
    text: str
    created_at: datetime


class StatusHistoryItem(APIModel):
    status: ApplicationStatus | str
    at: datetime | str
    by: str


class ApplicationDraftCreate(APIModel):
    funding_need_id: str | None = None
    product_id: str
    requested_amount: Money = Field(gt=0)
    term_months: int = Field(ge=1, le=360)
    rate: Money | None = None
    purpose: str | None = None
    goal_type: GoalType | None = None
    currency: str = "RUB"


class ApplicationCreate(APIModel):

    company_id: str
    product_id: str
    amount: Money = Field(gt=0)
    term_months: int = Field(ge=1)
    rate: Money | None = None
    purpose: str = ""
    funding_need_id: str | None = None
    goal_type: GoalType | None = None
    idempotency_key: str | None = None
    currency: str = "RUB"


class ApplicationUpdate(APIModel):
    amount: Money | None = Field(default=None, gt=0)
    requested_amount: Money | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, ge=1, le=360)
    rate: Money | None = None
    purpose: str | None = None
    product_id: str | None = None
    funding_need_id: str | None = None
    goal_type: GoalType | None = None
    version: int | None = Field(default=None, description="Optimistic lock")


class StatusUpdate(APIModel):
    status: ApplicationStatus
    comment: str | None = None
    idempotency_key: str | None = None


class DocsRequestIn(APIModel):
    document_type: str
    comment: str | None = None


class ApplicationOut(APIModel):
    id: str
    company_id: str
    funding_need_id: str | None = None
    product_id: str | None = None
    product_name: str | None = None
    product_type: ProductType | None = None
    goal_type: GoalType | None = None
    status: ApplicationStatus
    current_step: str | None = None
    version: int = 1
    amount: Money
    requested_amount: Money | None = None
    term_months: int
    rate: Money | None = None
    purpose: str = ""
    assigned_manager_id: str | None = None
    assigned_manager_name: str | None = None
    readiness_score: int = 0
    documents: list[DocumentOut] = []
    comments: list[CommentOut] = []
    status_history: list[StatusHistoryItem] = []
    created_at: datetime
    updated_at: datetime | None = None
    saved_at: datetime | None = None
    submitted_at: datetime | None = None
    ai_summary: str | None = None
    application_number: str | None = None
    currency: str = "RUB"


class ApplicationDraftCreated(APIModel):
    id: str
    status: ApplicationStatus = ApplicationStatus.DRAFT
    current_step: str = "CREDIT_PARAMETERS"
    version: int = 1
    saved_at: datetime
    company_id: str
    product_id: str | None = None
    requested_amount: Money
    term_months: int


class ValidationIssue(APIModel):
    field: str
    code: str
    message: str


class ApplicationValidationOut(APIModel):
    application_id: str
    status: ApplicationStatus
    can_submit: bool
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    readiness_score: int | None = None
    checked_at: datetime


class ApplicationSubmitOut(APIModel):
    application_id: str
    application_number: str
    status: ApplicationStatus
    workflow_id: str | None = None
    next_step: str = "AUTOMATED_VALIDATION"


class ApplicationStatusOut(APIModel):
    application_id: str
    status: ApplicationStatus
    current_step: str | None = None
    next_action: str | None = None
    application_number: str | None = None
    updated_at: datetime | None = None


class PublicCheckOut(APIModel):
    id: str
    check_key: str
    status: str
    score: int | None = None
    reason_codes: list[str] = []
    explanation: str | None = None
    created_at: datetime | None = None


class ApplicationChecksOut(APIModel):
    application_id: str
    status: ApplicationStatus
    checks: list[PublicCheckOut] = []


class ReasonCodeOut(APIModel):
    code: str
    title: str
    details: str | None = None


class DecisionOut(APIModel):
    application_id: str
    decision: DecisionType | str
    decision_scope: str = "DEMO_PRELIMINARY"
    reason_codes: list[ReasonCodeOut] = []
    policy_version: str | None = None
    updated_at: datetime | None = None
    explanation: str | None = None


class OfferOut(APIModel):
    id: str
    application_id: str
    decision_id: str | None = None
    product_id: str | None = None
    amount: Money
    term_months: int
    rate: Money
    monthly_payment: Money | None = None
    currency: str = "RUB"
    status: OfferStatus | str
    offer_version: int = 1
    is_alternative: bool = False
    label: str | None = None
    expires_at: datetime | None = None
    created_at: datetime | None = None
    conditions: dict = Field(default_factory=dict)


class OfferAcceptIn(APIModel):
    offer_version: int = 1
    accepted_terms: bool = True


class OfferAcceptOut(APIModel):
    application_id: str
    offer_id: str
    status: ApplicationStatus
    next_step: str = "AGREEMENT_PREPARATION"


class OfferDeclineIn(APIModel):
    reason: str | None = None
