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
from app.core.phone import mask_email
from app.schemas.auth import (
    AuthSessionOut,
    EmailActionOut,
    EmailActionRequest,
    LoginRequest,
    PasswordResetRequest,
    RefreshRequest,
    SessionOut,
    TokenPairOut,
    UserOut,
    UserPatch,
)
from app.schemas.common import MessageOut
from app.services import auth_flow
from app.services.audit import write_audit
from app.services.device_label import format_device_label
from app.services.email import get_email_provider

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
        mfa_enabled=bool(getattr(user, "mfa_enabled", False)),
    )


def _device_info(request: Request) -> str:
    """Persist raw User-Agent; list_sessions formats a friendly label."""
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


def _send_link_email(*, to: str, subject: str, link: str) -> str:
    settings = get_settings()
    provider = get_email_provider()
    text = (
        f"{subject}\n\nОткройте ссылку (действует ограниченное время):\n{link}\n\n"
        "Если вы не запрашивали это письмо — проигнорируйте его."
    )
    provider.send(to=to, subject=subject, text_body=text)
    return settings.email_provider or "console"


@router.post("/email/resend", response_model=EmailActionOut)
def email_resend(body: EmailActionRequest, db: DbDep, cid: CorrelationId) -> EmailActionOut:
    """Демо: шлёт ссылку подтверждения email (токен в письме / console log)."""
    email = body.email.strip().lower()
    user = auth_flow.find_user_by_email(db, email)
    # Always same shape — no email enumeration
    if user is None or not user.email:
        return EmailActionOut(
            message="Если аккаунт существует, мы отправили письмо",
            delivery_mode="console",
            email_masked=mask_email(email),
        )
    token = auth_flow.create_email_verify_token(user.id)
    settings = get_settings()
    link = f"{settings.frontend_url.rstrip('/')}/verify-email?token={token}"
    mode = _send_link_email(
        to=user.email, subject="Подтверждение email — Линия решения", link=link
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="email_verify_resend",
        correlation_id=cid,
    )
    db.commit()
    return EmailActionOut(
        message="Письмо отправлено",
        delivery_mode=mode,
        email_masked=mask_email(user.email),
        challenge_id=token[:12],
    )


@router.get("/email/verify", response_model=AuthSessionOut)
def email_verify(
    token: str,
    request: Request,
    response: Response,
    db: DbDep,
    cid: CorrelationId,
) -> AuthSessionOut:
    payload = auth_flow.decode_purpose_token(token, "email_verify")
    user = db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.id == payload["sub"])
    )
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пользователь не найден")
    auth_flow.mark_email_verified(db, user)
    access, refresh = auth_flow.issue_session(db, user, device_info=_device_info(request))
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="email_verified",
        correlation_id=cid,
        ip_address=client_ip(request),
    )
    db.commit()
    return _session_response(response, user, access, refresh)


@router.post("/password/forgot", response_model=EmailActionOut)
def password_forgot(body: EmailActionRequest, db: DbDep, cid: CorrelationId) -> EmailActionOut:
    email = body.email.strip().lower()
    user = auth_flow.find_user_by_email(db, email)
    if user is None or not user.email:
        return EmailActionOut(
            message="Если аккаунт существует, мы отправили ссылку для сброса",
            delivery_mode="console",
            email_masked=mask_email(email),
        )
    token = auth_flow.create_password_reset_token(user.id)
    settings = get_settings()
    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    mode = _send_link_email(to=user.email, subject="Сброс пароля — Линия решения", link=link)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="password_forgot",
        correlation_id=cid,
    )
    db.commit()
    return EmailActionOut(
        message="Если аккаунт существует, мы отправили ссылку для сброса",
        delivery_mode=mode,
        email_masked=mask_email(user.email),
        challenge_id=token[:12],
    )


@router.post("/password/reset", response_model=MessageOut)
def password_reset(
    body: PasswordResetRequest, request: Request, db: DbDep, cid: CorrelationId
) -> MessageOut:
    if body.password != body.password_confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пароли не совпадают")
    payload = auth_flow.decode_purpose_token(body.token, "password_reset")
    user = db.scalar(select(User).where(User.id == payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пользователь не найден")
    auth_flow.set_password(db, user, body.password)
    auth_flow.logout_all_sessions(db, user, correlation_id=cid)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="password_reset",
        correlation_id=cid,
        ip_address=client_ip(request),
    )
    db.commit()
    return MessageOut(message="Пароль обновлён")


@router.patch("/me", response_model=UserOut)
def patch_me(
    body: UserPatch, request: Request, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> UserOut:
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        return _user_out(user)
    auth_flow.patch_profile(db, user, patch)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="profile_patch",
        details={k: v for k, v in patch.items() if k != "password"},
        correlation_id=cid,
        ip_address=client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return _user_out(user)


def _access_jti(request: Request) -> str | None:
    token = None
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get(COOKIE_ACCESS)
    if not token:
        return None
    try:
        payload = decode_token(token)
    except InvalidTokenError:
        return None
    return payload.get("jti")


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(request: Request, db: DbDep, user: CurrentUser) -> list[SessionOut]:
    rows = auth_flow.list_active_sessions(db, user.id)
    access_jti = _access_jti(request)
    current_id = None
    if access_jti:
        match = next((s for s in rows if s.jti == access_jti), None)
        if match is not None:
            current_id = match.id
    if current_id is None and rows:
        current_id = rows[0].id
    return [
        SessionOut(
            id=s.id,
            device_info=format_device_label(s.device_info),
            created_at=s.created_at,
            expires_at=s.expires_at,
            current=s.id == current_id,
            revoked=bool(s.revoked),
        )
        for s in rows
    ]


@router.delete("/sessions/{session_id}", response_model=MessageOut)
def revoke_session(
    session_id: str, request: Request, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> MessageOut:
    rows = auth_flow.list_active_sessions(db, user.id)
    access_jti = _access_jti(request)
    current_id = None
    if access_jti:
        match = next((s for s in rows if s.jti == access_jti), None)
        if match is not None:
            current_id = match.id
    if current_id is None and rows:
        current_id = rows[0].id
    auth_flow.revoke_session(db, user, session_id, current_id=current_id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="auth_session",
        entity_id=session_id,
        action="session_revoke",
        correlation_id=cid,
        ip_address=client_ip(request),
    )
    db.commit()
    return MessageOut(message="ok")
