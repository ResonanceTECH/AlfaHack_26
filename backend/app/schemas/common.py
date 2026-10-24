from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from app.core.camel import api_model_config
from app.core.money import Money

T = TypeVar("T")


class APIModel(BaseModel):
    model_config = api_model_config()


class MessageOut(APIModel):
    message: str


class Paginated(APIModel, Generic[T]):
    items: list[T]
    total: int
    page: int = 1
    page_size: int = 50


class ErrorField(APIModel):
    field: str
    code: str


class ErrorBody(APIModel):
    code: str
    message: str
    fields: list[ErrorField] | None = None
    request_id: str | None = None


class ErrorResponse(APIModel):
    error: ErrorBody


class HealthOut(APIModel):
    status: str = "ok"
    service: str
    time: datetime = Field(default_factory=datetime.utcnow)


__all__ = [
    "APIModel",
    "MessageOut",
    "Paginated",
    "ErrorField",
    "ErrorBody",
    "ErrorResponse",
    "HealthOut",
    "Money",
]
