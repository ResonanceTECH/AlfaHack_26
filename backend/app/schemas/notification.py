from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class NotificationOut(APIModel):
    id: str
    type: str
    title: str
    body: str | None = None
    channel: str = "IN_APP"
    is_read: bool = False
    read_at: datetime | None = None
    created_at: datetime | None = None
    payload: dict = Field(default_factory=dict)


class NotificationPatch(APIModel):
    is_read: bool = True


class NotificationListOut(APIModel):
    items: list[NotificationOut]
    unread_count: int = 0
    total: int = 0


class ReadAllOut(APIModel):
    updated: int
