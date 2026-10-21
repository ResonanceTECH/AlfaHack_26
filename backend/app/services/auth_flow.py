from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.enums import ChallengeChannel, ChallengePurpose, UserRole, UserStatus
from app.core.otp import generate_otp_code, generate_url_token, hash_secret, hash_token, verify_secret
from app.core.phone import mask_email, mask_phone, normalize_ru_phone
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.models.finance import RefreshToken
from app.models.user import User
from app.models.verification import VerificationChallenge
from app.services.audit import write_audit
from app.services.email import EmailDeliveryError, get_email_provider
from app.services.email import templates as email_templates
from app.services.rate_limit import RateLimitExceeded, acquire_lock, check_otp_send_limits, hit, release_lock
from app.services.sms import SmsDeliveryError, get_sms_provider

logger = logging.getLogger("alfa.auth")

GENERIC_OK = "Если данные верны, мы отправили инструкции"
GENERIC_VERIFY_FAIL = "Неверный или просроченный код"
GENERIC_TOKEN_FAIL = "Ссылка недействительна или устарела"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


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


def user_out_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "full_name": user.full_name,
        "role": user.role,
        "company_id": user.company_id,
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "status": user.status,
    }


def _invalidate_active_challenges(
    db: Session,
    *,
    destination: str,
    purpose: ChallengePurpose,
    channel: ChallengeChannel,
) -> None:
    rows = db.scalars(
        select(VerificationChallenge).where(
            VerificationChallenge.destination == destination,
            VerificationChallenge.purpose == purpose,
            VerificationChallenge.channel == channel,
            VerificationChallenge.consumed_at.is_(None),
        )
    ).all()
    now = utcnow()
    for row in rows:
        row.consumed_at = now


def _create_otp_challenge(
    db: Session,
    *,
    destination: str,
    purpose: ChallengePurpose,
    channel: ChallengeChannel,
    user_id: str | None = None,
    registration_session_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> tuple[VerificationChallenge, str]:
    settings = get_settings()
    code = generate_otp_code()
    challenge = VerificationChallenge(
        user_id=user_id,
        registration_session_id=registration_session_id,
        purpose=purpose,
        channel=channel,
        destination=destination,
        code_hash=hash_secret(code),
        payload=payload,
        expires_at=utcnow() + timedelta(seconds=settings.otp_ttl_seconds),
        attempts_count=0,
        max_attempts=settings.otp_max_attempts,
        last_sent_at=utcnow(),
    )
    db.add(challenge)
    db.flush()
    return challenge, code


def _create_token_challenge(
    db: Session,
    *,
    destination: str,
    purpose: ChallengePurpose,
    user_id: str | None = None,
    payload: dict[str, Any] | None = None,
    ttl_seconds: int | None = None,
) -> tuple[VerificationChallenge, str]:
    settings = get_settings()
    token = generate_url_token()
    challenge = VerificationChallenge(
        user_id=user_id,
        purpose=purpose,
        channel=ChallengeChannel.EMAIL,
        destination=destination,
        code_hash=hash_secret(token),
        payload=payload,
        expires_at=utcnow() + timedelta(seconds=ttl_seconds or settings.email_token_ttl_seconds),
        attempts_count=0,
        max_attempts=5,
        last_sent_at=utcnow(),
    )
    db.add(challenge)
    db.flush()
    return challenge, token


def _send_sms(phone: str, code: str) -> str:
    settings = get_settings()
    try:
        provider = get_sms_provider()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    try:
        provider.send_verification_code_sync(phone, code)
    except SmsDeliveryError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    mode = (settings.sms_provider or "console").lower()
    return mode


def _send_email(to: str, subject: str, text: str, html: str) -> str:
    settings = get_settings()
    try:
        provider = get_email_provider()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    try:
        provider.send(to=to, subject=subject, text_body=text, html_body=html)
    except EmailDeliveryError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return (settings.email_provider or "console").lower()


def _check_resend_cooldown(challenge: VerificationChallenge | None) -> None:
    if challenge is None:
        return
    settings = get_settings()
    elapsed = (utcnow() - _aware(challenge.last_sent_at)).total_seconds()
    if elapsed < settings.otp_resend_seconds:
        wait = int(settings.otp_resend_seconds - elapsed) + 1
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Повторная отправка доступна через {wait} с",
        )


def verify_otp_challenge(
    db: Session,
    *,
    challenge_id: str,
    code: str,
    purpose: ChallengePurpose | None = None,
) -> VerificationChallenge:
    challenge = db.scalar(
        select(VerificationChallenge).where(VerificationChallenge.id == challenge_id)
    )
    if challenge is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_VERIFY_FAIL)
    if purpose and challenge.purpose != purpose:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_VERIFY_FAIL)
    if challenge.consumed_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_VERIFY_FAIL)
    if _aware(challenge.expires_at) < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Срок действия кода истёк")
    if challenge.attempts_count >= challenge.max_attempts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Превышено число попыток ввода кода")

    challenge.attempts_count += 1
    if not verify_secret(code.strip(), challenge.code_hash):
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_VERIFY_FAIL)

    challenge.consumed_at = utcnow()
    db.flush()
    return challenge


def start_phone_registration(
    db: Session,
    *,
    full_name: str,
    phone_raw: str,
    email: str | None,
    consent: bool,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    if not consent:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Требуется согласие на обработку данных")
    phone = normalize_ru_phone(phone_raw)
    email_norm = email.lower().strip() if email else None
    if email_norm and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_norm):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Некорректный email")

    existing = db.scalar(select(User).where(User.phone == phone))
    if existing is not None and existing.phone_verified_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Не удалось начать регистрацию. Возможно, номер уже используется.",
        )

    lock_key = f"regphone:{phone}"
    if not acquire_lock(lock_key, ttl_seconds=10):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Подождите и повторите запрос")

    try:
        try:
            check_otp_send_limits(destination=phone, ip=ip)
        except RateLimitExceeded as exc:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

        latest = db.scalar(
            select(VerificationChallenge)
            .where(
                VerificationChallenge.destination == phone,
                VerificationChallenge.purpose == ChallengePurpose.REGISTRATION,
                VerificationChallenge.channel == ChallengeChannel.SMS,
                VerificationChallenge.consumed_at.is_(None),
            )
            .order_by(VerificationChallenge.created_at.desc())
        )
        _check_resend_cooldown(latest)
        _invalidate_active_challenges(
            db, destination=phone, purpose=ChallengePurpose.REGISTRATION, channel=ChallengeChannel.SMS
        )

        session_id = str(uuid4())
        challenge, code = _create_otp_challenge(
            db,
            destination=phone,
            purpose=ChallengePurpose.REGISTRATION,
            channel=ChallengeChannel.SMS,
            registration_session_id=session_id,
            payload={
                "full_name": full_name.strip(),
                "phone": phone,
                "email": email_norm,
                "consent": True,
            },
        )
        delivery = _send_sms(phone, code)
        write_audit(
            db,
            actor_id=None,
            entity_type="auth",
            entity_id=challenge.id,
            action="register_phone_start",
            details={"phone": mask_phone(phone), "delivery": delivery},
            correlation_id=correlation_id,
            ip_address=ip,
        )
        db.commit()
        return {
            "challenge_id": challenge.id,
            "registration_session_id": session_id,
            "expires_in": get_settings().otp_ttl_seconds,
            "resend_after": get_settings().otp_resend_seconds,
            "delivery_mode": delivery,
            "destination_masked": mask_phone(phone),
        }
    finally:
        release_lock(lock_key)


def verify_phone_registration(
    db: Session,
    *,
    challenge_id: str,
    code: str,
    ip: str | None,
    correlation_id: str | None,
    device_info: str | None,
) -> tuple[User, str, str]:
    try:
        hit(f"otp:verify:{challenge_id}", limit=10, window_seconds=300)
    except RateLimitExceeded as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

    challenge = verify_otp_challenge(
        db, challenge_id=challenge_id, code=code, purpose=ChallengePurpose.REGISTRATION
    )
    payload = challenge.payload or {}
    phone = payload.get("phone") or challenge.destination
    full_name = (payload.get("full_name") or "").strip()
    email_norm = payload.get("email")

    existing = db.scalar(select(User).where(User.phone == phone))
    if existing is not None:
        if existing.phone_verified_at is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Номер уже зарегистрирован")
        user = existing
        user.full_name = full_name or user.full_name
        user.phone_verified_at = utcnow()
        user.status = UserStatus.ACTIVE
        user.is_active = True
        if email_norm and not user.email:
            taken = db.scalar(select(User.id).where(User.email == email_norm))
            if taken is None:
                user.email = email_norm
    else:
        if email_norm:
            taken = db.scalar(select(User.id).where(User.email == email_norm))
            if taken is not None:
                email_norm = None
        user = User(
            phone=phone,
            email=email_norm,
            password_hash=None,
            full_name=full_name,
            role=UserRole.ENTREPRENEUR,
            status=UserStatus.ACTIVE,
            phone_verified_at=utcnow(),
            email_verified_at=None,
            is_active=True,
        )
        db.add(user)
        db.flush()

    access, refresh = issue_session(db, user, device_info=device_info)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="register_phone_verify",
        details={"phone": mask_phone(phone)},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    user = db.scalar(select(User).options(joinedload(User.memberships)).where(User.id == user.id))
    assert user is not None
    return user, access, refresh


def register_email(
    db: Session,
    *,
    full_name: str,
    email: str,
    password: str,
    phone_raw: str | None,
    consent: bool,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    if not consent:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Требуется согласие на обработку данных")
    if len(password) < 12:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пароль не менее 12 символов")
    if len(password) > 256:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пароль слишком длинный")

    email_norm = email.lower().strip()
    phone = normalize_ru_phone(phone_raw) if phone_raw else None

    existing = db.scalar(select(User).where(User.email == email_norm))
    if existing is not None and existing.email_verified_at is not None:
        return {
            "message": GENERIC_OK,
            "delivery_mode": None,
            "email_masked": mask_email(email_norm),
        }

    if phone:
        phone_owner = db.scalar(select(User).where(User.phone == phone, User.phone_verified_at.is_not(None)))
        if phone_owner is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Телефон уже используется другим аккаунтом")

    lock_key = f"regemail:{email_norm}"
    if not acquire_lock(lock_key, ttl_seconds=10):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Подождите и повторите запрос")

    try:
        try:
            check_otp_send_limits(destination=email_norm, ip=ip)
        except RateLimitExceeded as exc:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

        if existing is None:
            user = User(
                email=email_norm,
                phone=phone,
                password_hash=hash_password(password),
                full_name=full_name.strip(),
                role=UserRole.ENTREPRENEUR,
                status=UserStatus.PENDING,
                email_verified_at=None,
                phone_verified_at=None,
                is_active=True,
            )
            db.add(user)
            db.flush()
        else:
            user = existing
            user.password_hash = hash_password(password)
            user.full_name = full_name.strip()
            if phone and not user.phone:
                user.phone = phone

        _invalidate_active_challenges(
            db,
            destination=email_norm,
            purpose=ChallengePurpose.REGISTRATION,
            channel=ChallengeChannel.EMAIL,
        )
        challenge, token = _create_token_challenge(
            db,
            destination=email_norm,
            purpose=ChallengePurpose.REGISTRATION,
            user_id=user.id,
            payload={"full_name": full_name.strip()},
        )
        subject, text, html = email_templates.verification_email(token, full_name.strip())
        delivery = _send_email(email_norm, subject, text, html)
        write_audit(
            db,
            actor_id=user.id,
            entity_type="user",
            entity_id=user.id,
            action="register_email",
            details={"email": mask_email(email_norm), "delivery": delivery},
            correlation_id=correlation_id,
            ip_address=ip,
        )
        db.commit()
        return {
            "message": "Письмо с подтверждением отправлено",
            "delivery_mode": delivery,
            "email_masked": mask_email(email_norm),
            "challenge_id": challenge.id,
        }
    finally:
        release_lock(lock_key)


def verify_email_token(
    db: Session,
    *,
    token: str,
    ip: str | None,
    correlation_id: str | None,
    device_info: str | None,
    auto_login: bool = True,
) -> tuple[User | None, str | None, str | None]:
    candidates = db.scalars(
        select(VerificationChallenge)
        .where(
            VerificationChallenge.purpose == ChallengePurpose.REGISTRATION,
            VerificationChallenge.channel == ChallengeChannel.EMAIL,
            VerificationChallenge.consumed_at.is_(None),
        )
        .order_by(VerificationChallenge.created_at.desc())
        .limit(200)
    ).all()

    challenge: VerificationChallenge | None = None
    for row in candidates:
        if verify_secret(token, row.code_hash):
            challenge = row
            break

    if challenge is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_TOKEN_FAIL)
    if _aware(challenge.expires_at) < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_TOKEN_FAIL)

    challenge.consumed_at = utcnow()
    user = db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.id == challenge.user_id)
    )
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_TOKEN_FAIL)

    user.email_verified_at = utcnow()
    user.status = UserStatus.ACTIVE
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="email_verified",
        details={"email": mask_email(user.email or "")},
        correlation_id=correlation_id,
        ip_address=ip,
    )

    access = refresh = None
    if auto_login:
        access, refresh = issue_session(db, user, device_info=device_info)
    db.commit()
    user = db.scalar(select(User).options(joinedload(User.memberships)).where(User.id == user.id))
    return user, access, refresh


def resend_email_verification(
    db: Session,
    *,
    email: str,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    email_norm = email.lower().strip()
    # Always same message
    response = {"message": GENERIC_OK, "delivery_mode": None, "email_masked": mask_email(email_norm)}

    user = db.scalar(select(User).where(User.email == email_norm))
    if user is None or user.email_verified_at is not None:
        return response

    try:
        check_otp_send_limits(destination=email_norm, ip=ip)
    except RateLimitExceeded:
        return response

    latest = db.scalar(
        select(VerificationChallenge)
        .where(
            VerificationChallenge.destination == email_norm,
            VerificationChallenge.purpose == ChallengePurpose.REGISTRATION,
            VerificationChallenge.channel == ChallengeChannel.EMAIL,
            VerificationChallenge.consumed_at.is_(None),
        )
        .order_by(VerificationChallenge.created_at.desc())
    )
    try:
        _check_resend_cooldown(latest)
    except HTTPException:
        return response

    _invalidate_active_challenges(
        db,
        destination=email_norm,
        purpose=ChallengePurpose.REGISTRATION,
        channel=ChallengeChannel.EMAIL,
    )
    _, token = _create_token_challenge(
        db,
        destination=email_norm,
        purpose=ChallengePurpose.REGISTRATION,
        user_id=user.id,
    )
    subject, text, html = email_templates.verification_email(token, user.full_name)
    try:
        delivery = _send_email(email_norm, subject, text, html)
    except HTTPException:
        db.rollback()
        return response

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="email_resend",
        details={"email": mask_email(email_norm), "delivery": delivery},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    response["delivery_mode"] = delivery
    return response


def start_phone_login(
    db: Session,
    *,
    phone_raw: str,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    phone = normalize_ru_phone(phone_raw)
    settings = get_settings()
    generic = {
        "challenge_id": str(uuid4()),
        "expires_in": settings.otp_ttl_seconds,
        "resend_after": settings.otp_resend_seconds,
        "delivery_mode": "none",
        "destination_masked": mask_phone(phone),
        "message": "Если номер зарегистрирован, мы отправили код",
    }

    user = db.scalar(
        select(User).where(User.phone == phone, User.phone_verified_at.is_not(None), User.is_active.is_(True))
    )
    if user is None:
        return generic

    lock_key = f"loginphone:{phone}"
    if not acquire_lock(lock_key, ttl_seconds=10):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Подождите и повторите запрос")
    try:
        try:
            check_otp_send_limits(destination=phone, ip=ip)
        except RateLimitExceeded as exc:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

        latest = db.scalar(
            select(VerificationChallenge)
            .where(
                VerificationChallenge.destination == phone,
                VerificationChallenge.purpose == ChallengePurpose.LOGIN,
                VerificationChallenge.channel == ChallengeChannel.SMS,
                VerificationChallenge.consumed_at.is_(None),
            )
            .order_by(VerificationChallenge.created_at.desc())
        )
        _check_resend_cooldown(latest)
        _invalidate_active_challenges(
            db, destination=phone, purpose=ChallengePurpose.LOGIN, channel=ChallengeChannel.SMS
        )
        challenge, code = _create_otp_challenge(
            db,
            destination=phone,
            purpose=ChallengePurpose.LOGIN,
            channel=ChallengeChannel.SMS,
            user_id=user.id,
        )
        delivery = _send_sms(phone, code)
        write_audit(
            db,
            actor_id=user.id,
            entity_type="user",
            entity_id=user.id,
            action="login_phone_start",
            details={"phone": mask_phone(phone), "delivery": delivery},
            correlation_id=correlation_id,
            ip_address=ip,
        )
        db.commit()
        return {
            "challenge_id": challenge.id,
            "expires_in": get_settings().otp_ttl_seconds,
            "resend_after": get_settings().otp_resend_seconds,
            "delivery_mode": delivery,
            "destination_masked": mask_phone(phone),
            "message": "Код отправлен",
        }
    finally:
        release_lock(lock_key)


def verify_phone_login(
    db: Session,
    *,
    challenge_id: str,
    code: str,
    ip: str | None,
    correlation_id: str | None,
    device_info: str | None,
) -> tuple[User, str, str]:
    challenge = verify_otp_challenge(
        db, challenge_id=challenge_id, code=code, purpose=ChallengePurpose.LOGIN
    )
    user = db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.id == challenge.user_id)
    )
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный или просроченный код")

    access, refresh = issue_session(db, user, device_info=device_info)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="login_phone_verify",
        details={"phone": mask_phone(user.phone or "")},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return user, access, refresh


def login_email(
    db: Session,
    *,
    email: str,
    password: str,
    ip: str | None,
    correlation_id: str | None,
    device_info: str | None,
) -> tuple[User, str, str]:
    email_norm = email.lower().strip()
    try:
        hit(f"login:email:{email_norm}", limit=10, window_seconds=900)
        if ip:
            hit(f"login:ip:{ip}", limit=30, window_seconds=900)
    except RateLimitExceeded as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

    user = db.scalar(
        select(User).options(joinedload(User.memberships)).where(User.email == email_norm)
    )
    bad = HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")
    if user is None or not user.password_hash or not verify_password(password, user.password_hash):
        raise bad
    if not user.is_active or user.status == UserStatus.DISABLED:
        raise bad
    if user.email_verified_at is None and user.status == UserStatus.PENDING:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Подтвердите email перед входом")

    access, refresh = issue_session(db, user, device_info=device_info)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="login_email",
        details={"email": mask_email(email_norm)},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return user, access, refresh


def forgot_password(
    db: Session,
    *,
    email: str,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    email_norm = email.lower().strip()
    response = {"message": GENERIC_OK, "delivery_mode": None}

    user = db.scalar(select(User).where(User.email == email_norm, User.is_active.is_(True)))
    if user is None or not user.password_hash:
        return response

    try:
        check_otp_send_limits(destination=f"pwd:{email_norm}", ip=ip)
    except RateLimitExceeded:
        return response

    _invalidate_active_challenges(
        db,
        destination=email_norm,
        purpose=ChallengePurpose.PASSWORD_RESET,
        channel=ChallengeChannel.EMAIL,
    )
    _, token = _create_token_challenge(
        db,
        destination=email_norm,
        purpose=ChallengePurpose.PASSWORD_RESET,
        user_id=user.id,
        ttl_seconds=3600,
    )
    subject, text, html = email_templates.password_reset_email(token, user.full_name)
    try:
        delivery = _send_email(email_norm, subject, text, html)
    except HTTPException:
        db.rollback()
        return response

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="password_forgot",
        details={"email": mask_email(email_norm), "delivery": delivery},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    response["delivery_mode"] = delivery
    return response


def reset_password(
    db: Session,
    *,
    token: str,
    new_password: str,
    ip: str | None,
    correlation_id: str | None,
) -> None:
    if len(new_password) < 12:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пароль не менее 12 символов")
    if len(new_password) > 256:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пароль слишком длинный")

    candidates = db.scalars(
        select(VerificationChallenge)
        .where(
            VerificationChallenge.purpose == ChallengePurpose.PASSWORD_RESET,
            VerificationChallenge.channel == ChallengeChannel.EMAIL,
            VerificationChallenge.consumed_at.is_(None),
        )
        .order_by(VerificationChallenge.created_at.desc())
        .limit(200)
    ).all()
    challenge = next((c for c in candidates if verify_secret(token, c.code_hash)), None)
    if challenge is None or _aware(challenge.expires_at) < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_TOKEN_FAIL)

    user = db.scalar(select(User).where(User.id == challenge.user_id))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_TOKEN_FAIL)

    challenge.consumed_at = utcnow()
    user.password_hash = hash_password(new_password)
    tokens = db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))).all()
    now = utcnow()
    for t in tokens:
        t.revoked = True
        t.revoked_at = now

    if user.email:
        subject, text, html = email_templates.critical_change_email(
            user.full_name, "Пароль вашего аккаунта был изменён."
        )
        try:
            _send_email(user.email, subject, text, html)
        except HTTPException:
            pass

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="password_reset",
        details={},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()


def start_link_email(
    db: Session,
    user: User,
    *,
    email: str,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    email_norm = email.lower().strip()
    if user.email and user.email_verified_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email уже привязан к аккаунту")

    owner = db.scalar(
        select(User).where(User.email == email_norm, User.id != user.id, User.email_verified_at.is_not(None))
    )
    if owner is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Этот email уже используется другим аккаунтом")

    try:
        check_otp_send_limits(destination=email_norm, ip=ip)
    except RateLimitExceeded as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

    _invalidate_active_challenges(
        db,
        destination=email_norm,
        purpose=ChallengePurpose.CONTACT_CHANGE,
        channel=ChallengeChannel.EMAIL,
    )
    challenge, token = _create_token_challenge(
        db,
        destination=email_norm,
        purpose=ChallengePurpose.CONTACT_CHANGE,
        user_id=user.id,
        payload={"email": email_norm},
    )
    subject, text, html = email_templates.verification_email(token, user.full_name)
    delivery = _send_email(email_norm, subject, text, html)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="link_email_start",
        details={"email": mask_email(email_norm), "delivery": delivery},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return {
        "message": "Письмо для подтверждения отправлено",
        "challenge_id": challenge.id,
        "delivery_mode": delivery,
        "email_masked": mask_email(email_norm),
    }


def verify_link_email(
    db: Session,
    user: User,
    *,
    token: str,
    ip: str | None,
    correlation_id: str | None,
) -> User:
    candidates = db.scalars(
        select(VerificationChallenge)
        .where(
            VerificationChallenge.user_id == user.id,
            VerificationChallenge.purpose == ChallengePurpose.CONTACT_CHANGE,
            VerificationChallenge.channel == ChallengeChannel.EMAIL,
            VerificationChallenge.consumed_at.is_(None),
        )
        .order_by(VerificationChallenge.created_at.desc())
        .limit(50)
    ).all()
    challenge = next((c for c in candidates if verify_secret(token, c.code_hash)), None)
    if challenge is None or _aware(challenge.expires_at) < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=GENERIC_TOKEN_FAIL)

    email_norm = (challenge.payload or {}).get("email") or challenge.destination
    owner = db.scalar(
        select(User).where(User.email == email_norm, User.id != user.id, User.email_verified_at.is_not(None))
    )
    if owner is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Этот email уже используется другим аккаунтом")

    challenge.consumed_at = utcnow()
    user.email = email_norm
    user.email_verified_at = utcnow()
    if user.status == UserStatus.PENDING:
        user.status = UserStatus.ACTIVE

    subject, text, html = email_templates.contact_linked_email(
        user.full_name, "email", mask_email(email_norm)
    )
    try:
        _send_email(email_norm, subject, text, html)
    except HTTPException:
        pass

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="link_email_verify",
        details={"email": mask_email(email_norm)},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return user


def start_link_phone(
    db: Session,
    user: User,
    *,
    phone_raw: str,
    ip: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    phone = normalize_ru_phone(phone_raw)
    if user.phone and user.phone_verified_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Телефон уже привязан к аккаунту")

    owner = db.scalar(
        select(User).where(User.phone == phone, User.id != user.id, User.phone_verified_at.is_not(None))
    )
    if owner is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Этот телефон уже используется другим аккаунтом")

    try:
        check_otp_send_limits(destination=phone, ip=ip)
    except RateLimitExceeded as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.message) from exc

    _invalidate_active_challenges(
        db, destination=phone, purpose=ChallengePurpose.CONTACT_CHANGE, channel=ChallengeChannel.SMS
    )
    challenge, code = _create_otp_challenge(
        db,
        destination=phone,
        purpose=ChallengePurpose.CONTACT_CHANGE,
        channel=ChallengeChannel.SMS,
        user_id=user.id,
        payload={"phone": phone},
    )
    delivery = _send_sms(phone, code)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="link_phone_start",
        details={"phone": mask_phone(phone), "delivery": delivery},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return {
        "challenge_id": challenge.id,
        "expires_in": get_settings().otp_ttl_seconds,
        "resend_after": get_settings().otp_resend_seconds,
        "delivery_mode": delivery,
        "destination_masked": mask_phone(phone),
    }


def verify_link_phone(
    db: Session,
    user: User,
    *,
    challenge_id: str,
    code: str,
    ip: str | None,
    correlation_id: str | None,
) -> User:
    challenge = verify_otp_challenge(
        db, challenge_id=challenge_id, code=code, purpose=ChallengePurpose.CONTACT_CHANGE
    )
    if challenge.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Нет доступа")

    phone = (challenge.payload or {}).get("phone") or challenge.destination
    owner = db.scalar(
        select(User).where(User.phone == phone, User.id != user.id, User.phone_verified_at.is_not(None))
    )
    if owner is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Этот телефон уже используется другим аккаунтом")

    user.phone = phone
    user.phone_verified_at = utcnow()

    if user.email and user.email_verified_at:
        subject, text, html = email_templates.contact_linked_email(
            user.full_name, "телефон", mask_phone(phone)
        )
        try:
            _send_email(user.email, subject, text, html)
        except HTTPException:
            pass

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="link_phone_verify",
        details={"phone": mask_phone(phone)},
        correlation_id=correlation_id,
        ip_address=ip,
    )
    db.commit()
    return user


def logout_session(db: Session, user: User, refresh_token: str | None, *, correlation_id: str | None) -> None:
    from app.core.security import decode_token
    from jwt.exceptions import InvalidTokenError

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
                select(RefreshToken).where(RefreshToken.token_hash == th, RefreshToken.user_id == user.id)
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
