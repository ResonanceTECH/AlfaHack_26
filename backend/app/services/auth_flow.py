from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.enums import UserRole, UserStatus
from app.core.otp import hash_token
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.session import RefreshToken
from app.models.user import User
from app.services.audit import write_audit
from app.services.rate_limit import RateLimitExceeded, hit


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def redirect_for_role(role: UserRole) -> str:
    if role == UserRole.ANALYST:
        return "/app/analyst"
    if role == UserRole.ADMIN:
        return "/app/admin"
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
        .where(or_(User.email == login_norm, User.login == login_norm, User.id == login))
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


def ensure_unique_contacts(
    db: Session,
    *,
    email: str | None,
    phone: str | None,
    exclude_id: str,
) -> None:
    if email:
        taken = db.scalar(select(User).where(User.email == email, User.id != exclude_id))
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Email уже занят")
    if phone:
        taken = db.scalar(select(User).where(User.phone == phone, User.id != exclude_id))
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Телефон уже занят")


def patch_profile(db: Session, user: User, patch: dict) -> User:
    email = patch.get("email")
    phone = patch.get("phone")
    if email is not None:
        email = email.strip().lower() or None
        patch["email"] = email
    if phone is not None:
        phone = phone.strip() or None
        patch["phone"] = phone
    ensure_unique_contacts(db, email=email, phone=phone, exclude_id=user.id)
    if "full_name" in patch and patch["full_name"]:
        user.full_name = patch["full_name"].strip()
    if "email" in patch:
        user.email = patch["email"]
    if "phone" in patch:
        user.phone = patch["phone"]
    db.flush()
    return user


def list_active_sessions(db: Session, user_id: str) -> list[RefreshToken]:
    return list(
        db.scalars(
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .order_by(RefreshToken.created_at.desc())
        ).all()
    )


def revoke_session(db: Session, user: User, session_id: str, *, current_id: str | None) -> None:
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.id == session_id, RefreshToken.user_id == user.id)
    )
    if stored is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")
    if stored.revoked:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Сессия уже отозвана")
    if current_id and stored.id == current_id:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Нельзя отозвать текущую сессию")
    stored.revoked = True
    stored.revoked_at = utcnow()
    db.flush()


def _purpose_token(subject: str, purpose: str, *, hours: int = 24) -> str:
    settings = get_settings()
    now = utcnow()
    payload = {
        "sub": subject,
        "type": purpose,
        "iat": now,
        "exp": now + timedelta(hours=hours),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_email_verify_token(user_id: str) -> str:
    return _purpose_token(user_id, "email_verify", hours=48)


def create_password_reset_token(user_id: str) -> str:
    return _purpose_token(user_id, "password_reset", hours=2)


def decode_purpose_token(token: str, purpose: str) -> dict:
    try:
        payload = decode_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Ссылка недействительна или устарела") from exc
    if payload.get("type") != purpose:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Неверный тип токена")
    return payload


def find_user_by_email(db: Session, email: str) -> User | None:
    email_norm = email.strip().lower()
    return db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.email == email_norm)
    )


def mark_email_verified(db: Session, user: User) -> User:
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
        if user.status == UserStatus.PENDING:
            user.status = UserStatus.ACTIVE
        db.flush()
    return user


def set_password(db: Session, user: User, password: str) -> User:
    user.password_hash = hash_password(password)
    db.flush()
    return user
