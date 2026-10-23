from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.enums import UserRole, UserStatus
from app.core.otp import hash_token
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models.finance import RefreshToken
from app.models.user import User
from app.services.audit import write_audit
from app.services.rate_limit import RateLimitExceeded, hit


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def redirect_for_role(role: UserRole) -> str:
    if role == UserRole.ANALYST:
        return "/bank/queue"
    if role == UserRole.ADMIN:
        return "/admin"
    return "/select-company"


def issue_session(
    db: Session,
    user: User,
    *,
    device_info: str | None = None,
) -> tuple[str, str]:
    settings = get_settings()
    access = create_access_token(user.id, extra={"role": user.role.value})
    refresh, jti = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(refresh),
            device_info=(device_info or "")[:512] or None,
            expires_at=utcnow() + timedelta(days=settings.refresh_ttl_days),
        )
    )
    user.last_login_at = utcnow()
    return access, refresh


def login(
    db: Session,
    *,
    login: str,
    password: str,
    ip: str | None,
    correlation_id: str | None,
    device_info: str | None,
) -> tuple[User, str, str]:
    login_norm = login.lower().strip()
    try:
        hit(f"login:id:{login_norm}", limit=10, window_seconds=900)
        if ip:
            hit(f"login:ip:{ip}", limit=30, window_seconds=900)
    except RateLimitExceeded as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

    user = db.scalar(
        select(User)
        .options(joinedload(User.memberships))
        .where(or_(User.email == login_norm, User.id == login))
    )
    bad = HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    if user is None or not user.password_hash or not verify_password(password, user.password_hash):
        raise bad
    if not user.is_active or user.status == UserStatus.DISABLED:
        raise bad

    access, refresh = issue_session(db, user, device_info=device_info)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="login",
        details={"login": login_norm},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return user, access, refresh


def logout_session(
    db: Session, user: User, refresh_token: str | None, *, correlation_id: str | None
) -> None:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti")
            stored = db.scalar(
                select(RefreshToken).where(RefreshToken.jti == jti, RefreshToken.user_id == user.id)
            )
            if stored and not stored.revoked:
                stored.revoked = True
                stored.revoked_at = utcnow()
        except InvalidTokenError:
            th = hash_token(refresh_token)
            stored = db.scalar(
                select(RefreshToken).where(
                    RefreshToken.token_hash == th, RefreshToken.user_id == user.id
                )
            )
            if stored and not stored.revoked:
                stored.revoked = True
                stored.revoked_at = utcnow()

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="logout",
        correlation_id=correlation_id,
    )
    db.commit()


def logout_all_sessions(db: Session, user: User, *, correlation_id: str | None) -> int:
    tokens = db.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
    ).all()
    now = utcnow()
    for t in tokens:
        t.revoked = True
        t.revoked_at = now
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="logout_all",
        details={"count": len(tokens)},
        correlation_id=correlation_id,
    )
    db.commit()
    return len(tokens)
