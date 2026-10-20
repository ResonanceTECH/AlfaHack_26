from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from app.core.camel import api_model_config

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


class ErrorDetail(APIModel):
    detail: str
    code: str | None = None
    extra: dict[str, Any] | None = None


class HealthOut(APIModel):
    status: str = "ok"
    service: str
    time: datetime = Field(default_factory=datetime.utcnow)
