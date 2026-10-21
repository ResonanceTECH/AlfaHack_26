from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.core.enums import ApplicationStatus, UserRole
from app.schemas.common import APIModel

class DocumentOut(APIModel):
    id: str
    type: str
    name: str
    size: int
    uploaded_at: datetime
    status: str

class CommentOut(APIModel):
    id: str
    author_id: str | None
    author_name: str
    author_role: UserRole | str
    text: str
    created_at: datetime

class StatusHistoryItem(APIModel):
    status: ApplicationStatus
    at: datetime | str
    by: str

class ApplicationCreate(APIModel):
    company_id: str
    product_id: str
    amount: Decimal = Field(gt=0)
    term_months: int = Field(ge=1)
    rate: Decimal
    purpose: str = ""
    idempotency_key: str | None = None

class ApplicationUpdate(APIModel):
    amount: Decimal | None = None
    term_months: int | None = None
    rate: Decimal | None = None
    purpose: str | None = None

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
    product_id: str
    product_name: str
    status: ApplicationStatus
    amount: Decimal
    term_months: int
    rate: Decimal
    purpose: str
    assigned_manager_id: str | None = None
    assigned_manager_name: str | None = None
    readiness_score: int
    documents: list[DocumentOut] = []
    comments: list[CommentOut] = []
    status_history: list[StatusHistoryItem] = []
    created_at: datetime
    updated_at: datetime
    ai_summary: str | None = None
