from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.schemas.common import APIModel


class CompanyTaskOut(APIModel):
    id: str
    company_id: str
    title: str
    description: str | None = None
    status: str
    assignee_user_id: str | None = None
    assignee_name: str | None = None
    assignee_email: str | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    due_date: date | None = None
    obligation_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CompanyTaskCreate(APIModel):
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    assignee_user_id: str | None = None
    due_date: date | None = None
    status: str = "todo"


class CompanyTaskUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None
    assignee_user_id: str | None = None
    due_date: date | None = None
    status: str | None = None
