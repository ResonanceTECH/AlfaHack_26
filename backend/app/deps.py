from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[Session, Depends(get_db)]


def get_correlation_id(
    request: Request,
    x_correlation_id: Annotated[str | None, Header()] = None,
) -> str:
    cid = x_correlation_id or request.headers.get("X-Request-ID") or str(uuid4())
    request.state.correlation_id = cid
    return cid


def get_current_user(
    request: Request,
    db: DbDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> User:
    token = None
    if credentials is not None and credentials.credentials:
        token = credentials.credentials
    if not token:
        token = request.cookies.get("alfa_access")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    try:
        payload = decode_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен") from exc
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Ожидается access-токен")
    user_id = payload.get("sub")
    user = db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.id == user_id)
    )
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CorrelationId = Annotated[str, Depends(get_correlation_id)]


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
