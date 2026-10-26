from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class DocumentReviewOut(APIModel):
    id: str
    company_id: str
    application_id: str | None = None
    document_id: str | None = None
    company_document_id: str | None = None
    kind: str
    slot_key: str | None = None
    title: str
    file_name: str | None = None
    assignee_user_id: str
    assignee_name: str | None = None
    assignee_email: str | None = None
    assigned_by: str | None = None
    assigned_by_name: str | None = None
    purpose: str = "review"
    status: str = "pending"
    task_id: str | None = None
    comment: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DocumentReviewItemIn(APIModel):
    kind: str = "app_slot"
    slot_key: str | None = None
    document_id: str | None = None
    company_document_id: str | None = None
    title: str = Field(min_length=1, max_length=512)
    file_name: str | None = None


class DocumentReviewAssignIn(APIModel):
    """Assign one document or a pack of application slots to a teammate."""

    assignee_user_id: str = Field(min_length=1)
    application_id: str | None = None
    purpose: str = "review"
    due_days: int = Field(default=3, ge=1, le=30)
    items: list[DocumentReviewItemIn] = Field(default_factory=list)
    # Convenience: when true and application_id set, items may be empty —
    # caller should still send items from FE for slot titles.


class DocumentReviewPatch(APIModel):
    status: str | None = None
    comment: str | None = None
