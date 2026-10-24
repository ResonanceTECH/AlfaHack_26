from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.config import get_settings
from app.core.rbac import permission_codes
from app.core.security import decode_token
from app.deps import CorrelationId, CurrentUser, DbDep, client_ip
from app.models.session import RefreshToken
from app.models.user import User
from app.schemas.auth import AuthSessionOut, LoginRequest, RefreshRequest, TokenPairOut, UserOut
from app.schemas.common import MessageOut
from app.services import auth_flow

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_ACCESS = "alfa_access"
COOKIE_REFRESH = "alfa_refresh"


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        display_name=user.full_name,
        role=user.role,
        company_id=user.company_id,
        permissions=permission_codes(user.role),
        status=user.status,
    )


def _device_info(request: Request) -> str:
    return (request.headers.get("User-Agent") or "")[:400]


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    settings = get_settings()
    secure = settings.is_production
    response.set_cookie(
        COOKIE_ACCESS,
        access,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.access_ttl_minutes * 60,
        path="/",
    )
    response.set_cookie(
        COOKIE_REFRESH,
        refresh,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_ttl_days * 86400,
        path="/api/v1/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/api/v1/auth")


def _session_response(
    response: Response, user: User, access: str, refresh: str
) -> AuthSessionOut:
    settings = get_settings()
    _set_auth_cookies(response, access, refresh)
    return AuthSessionOut(
        access_token=access,
        token_type="bearer",
        expires_in=settings.access_ttl_minutes * 60,
        refresh_token=refresh,
        user=_user_out(user),
        redirect_to=auth_flow.redirect_for_role(user.role),
    )


@router.post("/login", response_model=AuthSessionOut)
def login(
    body: LoginRequest, request: Request, response: Response, db: DbDep, cid: CorrelationId
) -> AuthSessionOut:
    user, access, refresh = auth_flow.login(
        db,
        login=body.login,
        password=body.password,
        ip=client_ip(request),
        correlation_id=cid,
        device_info=_device_info(request),
    )
    return _session_response(response, user, access, refresh)


@router.post("/refresh", response_model=TokenPairOut)
def refresh(body: RefreshRequest, request: Request, response: Response, db: DbDep) -> TokenPairOut:
    token = body.refresh_token or request.cookies.get(COOKIE_REFRESH, "")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Требуется refresh-токен")
    try:
        payload = decode_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Недействительный refresh") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Ожидается refresh-токен")
    jti = payload.get("jti")
    stored = db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if stored is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh-токен отозван")
    if stored.revoked:
        victim = db.scalar(select(User).where(User.id == stored.user_id))
        if victim is not None:
            auth_flow.logout_all_sessions(db, victim, correlation_id=None)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh-токен отозван")
    exp = stored.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh-токен истёк")

    user = db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.id == payload["sub"])
    )
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

    stored.revoked = True
    stored.revoked_at = datetime.now(timezone.utc)
    access, refresh_token = auth_flow.issue_session(
        db, user, device_info=_device_info(request)
    )
    db.commit()
    settings = get_settings()
    _set_auth_cookies(response, access, refresh_token)
    return TokenPairOut(
        access_token=access,
        token_type="bearer",
        expires_in=settings.access_ttl_minutes * 60,
        refresh_token=refresh_token,
    )


@router.post("/logout", response_model=MessageOut)
def logout(
    request: Request,
    response: Response,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    body: RefreshRequest | None = None,
) -> MessageOut:
    token = (body.refresh_token if body else None) or request.cookies.get(COOKIE_REFRESH)
    auth_flow.logout_session(db, user, token, correlation_id=cid)
    _clear_auth_cookies(response)
    return MessageOut(message="ok")


@router.post("/logout-all", response_model=MessageOut)
def logout_all(response: Response, db: DbDep, user: CurrentUser, cid: CorrelationId) -> MessageOut:
    n = auth_flow.logout_all_sessions(db, user, correlation_id=cid)
    _clear_auth_cookies(response)
    return MessageOut(message=f"revoked:{n}")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return _user_out(user)
