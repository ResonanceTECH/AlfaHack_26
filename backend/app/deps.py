from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.db.session import get_db

DbDep = Annotated[Session, Depends(get_db)]


def get_correlation_id(
    request: Request,
    x_correlation_id: Annotated[str | None, Header()] = None,
) -> str:
    cid = x_correlation_id or request.headers.get("X-Request-ID") or str(uuid4())
    request.state.correlation_id = cid
    return cid


CorrelationId = Annotated[str, Depends(get_correlation_id)]


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
