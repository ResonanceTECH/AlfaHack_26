from __future__ import annotations

from datetime import datetime

from app.core.enums import ApplicationStatus
from app.core.money import Money
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
