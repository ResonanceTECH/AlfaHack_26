from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.config import get_settings
from app.core.enums import MemberRole, UserRole, UserStatus
from app.core.security import decode_token, hash_password
from app.deps import CorrelationId, CurrentUser, DbDep, client_ip
from app.models.company import Company, CompanyMember
from app.models.finance import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    AuthSessionOut,
    ChallengeStartOut,
    EmailActionOut,
    EmailLoginIn,
    EmailRegisterIn,
    EmailResendIn,
    LinkEmailIn,
    LinkEmailVerifyIn,
    LinkPhoneIn,
    LinkPhoneVerifyIn,
    LoginRequest,
    PasswordForgotIn,
    PasswordResetIn,
    PhoneLoginStartIn,
    PhoneLoginVerifyIn,
    PhoneRegisterStartIn,
    PhoneRegisterVerifyIn,
    RefreshRequest,
    RegisterRequest,
    TokenPairOut,
    UserOut,
)
from app.schemas.common import MessageOut
from app.services import auth_flow
from app.services.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_ACCESS = "alfa_access"
COOKIE_REFRESH = "alfa_refresh"


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        role=user.role,
        company_id=user.company_id,
        email_verified=user.email_verified,
        phone_verified=user.phone_verified,
        status=user.status,
    )


def _device_info(request: Request) -> str:
    ua = request.headers.get("User-Agent", "")[:400]
    return ua


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


def _issue_tokens(db: DbDep, user: User, device_info: str | None = None) -> tuple[str, str]:
    return auth_flow.issue_session(db, user, device_info=device_info)


def _session_response(
    response: Response, user: User, access: str, refresh: str
) -> AuthSessionOut:
    _set_auth_cookies(response, access, refresh)
    return AuthSessionOut(user=_user_out(user), access_token=access, refresh_token=refresh)


@router.post("/register", response_model=AuthSessionOut, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest, request: Request, response: Response, db: DbDep, cid: CorrelationId
) -> AuthSessionOut:
    email = body.email.lower().strip()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email уже зарегистрирован")

    if body.company is not None:
        inn_taken = db.scalar(select(Company.id).where(Company.inn == body.company.inn))
        if inn_taken is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Компания с таким ИНН уже существует")

    now = datetime.now(timezone.utc)
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        role=UserRole.ENTREPRENEUR,
        status=UserStatus.ACTIVE,
        email_verified_at=now,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if body.company is not None:
        c = body.company
        company = Company(
            inn=c.inn,
            name=c.name.strip(),
            legal_form=c.legal_form,
            ogrn=c.ogrn,
            industry=c.industry.strip(),
            registration_date=c.registration_date,
            region=c.region.strip(),
            employees_count=c.employees_count,
        )
        db.add(company)
        db.flush()
        db.add(
            CompanyMember(
                company_id=company.id,
                user_id=user.id,
                role=MemberRole.OWNER,
                permissions={"read": True, "write": True, "submit": True},
            )
        )
        db.flush()

    db.refresh(user, attribute_names=["memberships"])
    access, refresh = _issue_tokens(db, user, device_info=_device_info(request))
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        action="register",
        details={"email": email, "has_company": body.company is not None, "legacy": True},
        correlation_id=cid,
        ip_address=client_ip(request),
    )
    db.commit()

    user = db.scalar(select(User).options(joinedload(User.memberships)).where(User.id == user.id))
    assert user is not None
    return _session_response(response, user, access, refresh)


@router.post("/login", response_model=AuthSessionOut)
def login(
    body: LoginRequest, request: Request, response: Response, db: DbDep, cid: CorrelationId
) -> AuthSessionOut:
    user, access, refresh = auth_flow.login_email(
        db,
        email=str(body.email),
        password=body.password,
        ip=client_ip(request),
        correlation_id=cid,
        device_info=_device_info(request),
    )
    return _session_response(response, user, access, refresh)


@router.post("/refresh", response_model=TokenPairOut)
def refresh(body: RefreshRequest, request: Request, response: Response, db: DbDep) -> TokenPairOut:
    token = body.refresh_token or request.cookies.get(COOKIE_REFRESH, "")
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
    access, refresh_token = _issue_tokens(db, user, device_info=_device_info(request))
    db.commit()
    _set_auth_cookies(response, access, refresh_token)
    return TokenPairOut(access_token=access, refresh_token=refresh_token)


@router.post("/token/refresh", response_model=TokenPairOut)
def token_refresh(
    body: RefreshRequest, request: Request, response: Response, db: DbDep
) -> TokenPairOut:
    return refresh(body, request, response, db)


@router.post("/logout", response_model=MessageOut)
def logout(
    body: RefreshRequest,
    request: Request,
    response: Response,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> MessageOut:
    token = body.refresh_token or request.cookies.get(COOKIE_REFRESH)
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


@router.post("/register/phone/start", response_model=ChallengeStartOut)
def register_phone_start(
    body: PhoneRegisterStartIn, request: Request, db: DbDep, cid: CorrelationId
) -> ChallengeStartOut:
    data = auth_flow.start_phone_registration(
        db,
        full_name=body.full_name,
        phone_raw=body.phone,
        email=str(body.email) if body.email else None,
        consent=body.consent,
        ip=client_ip(request),
        correlation_id=cid,
    )
    return ChallengeStartOut(**data)


@router.post("/register/phone/verify", response_model=AuthSessionOut)
def register_phone_verify(
    body: PhoneRegisterVerifyIn,
    request: Request,
    response: Response,
    db: DbDep,
    cid: CorrelationId,
) -> AuthSessionOut:
    user, access, refresh_tok = auth_flow.verify_phone_registration(
        db,
        challenge_id=body.challenge_id,
        code=body.code,
        ip=client_ip(request),
        correlation_id=cid,
        device_info=_device_info(request),
    )
    return _session_response(response, user, access, refresh_tok)


@router.post("/register/email", response_model=EmailActionOut, status_code=status.HTTP_201_CREATED)
def register_email(
    body: EmailRegisterIn, request: Request, db: DbDep, cid: CorrelationId
) -> EmailActionOut:
    data = auth_flow.register_email(
        db,
        full_name=body.full_name,
        email=str(body.email),
        password=body.password,
        phone_raw=body.phone,
        consent=body.consent,
        ip=client_ip(request),
        correlation_id=cid,
    )
    return EmailActionOut(**data)


@router.get("/email/verify", response_model=AuthSessionOut)
def email_verify(
    token: str,
    request: Request,
    response: Response,
    db: DbDep,
    cid: CorrelationId,
) -> AuthSessionOut:
    user, access, refresh_tok = auth_flow.verify_email_token(
        db,
        token=token,
        ip=client_ip(request),
        correlation_id=cid,
        device_info=_device_info(request),
        auto_login=True,
    )
    if user is None or access is None or refresh_tok is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Ссылка недействительна или устарела")
    return _session_response(response, user, access, refresh_tok)


@router.post("/email/resend", response_model=EmailActionOut)
def email_resend(
    body: EmailResendIn, request: Request, db: DbDep, cid: CorrelationId
) -> EmailActionOut:
    data = auth_flow.resend_email_verification(
        db, email=str(body.email), ip=client_ip(request), correlation_id=cid
    )
    return EmailActionOut(**data)


@router.post("/login/phone/start", response_model=ChallengeStartOut)
def login_phone_start(
    body: PhoneLoginStartIn, request: Request, db: DbDep, cid: CorrelationId
) -> ChallengeStartOut:
    data = auth_flow.start_phone_login(
        db, phone_raw=body.phone, ip=client_ip(request), correlation_id=cid
    )
    return ChallengeStartOut(**data)


@router.post("/login/phone/verify", response_model=AuthSessionOut)
def login_phone_verify(
    body: PhoneLoginVerifyIn,
    request: Request,
    response: Response,
    db: DbDep,
    cid: CorrelationId,
) -> AuthSessionOut:
    user, access, refresh_tok = auth_flow.verify_phone_login(
        db,
        challenge_id=body.challenge_id,
        code=body.code,
        ip=client_ip(request),
        correlation_id=cid,
        device_info=_device_info(request),
    )
    return _session_response(response, user, access, refresh_tok)


@router.post("/login/email", response_model=AuthSessionOut)
def login_email(
    body: EmailLoginIn, request: Request, response: Response, db: DbDep, cid: CorrelationId
) -> AuthSessionOut:
    user, access, refresh_tok = auth_flow.login_email(
        db,
        email=str(body.email),
        password=body.password,
        ip=client_ip(request),
        correlation_id=cid,
        device_info=_device_info(request),
    )
    return _session_response(response, user, access, refresh_tok)


@router.post("/password/forgot", response_model=EmailActionOut)
def password_forgot(
    body: PasswordForgotIn, request: Request, db: DbDep, cid: CorrelationId
) -> EmailActionOut:
    data = auth_flow.forgot_password(
        db, email=str(body.email), ip=client_ip(request), correlation_id=cid
    )
    return EmailActionOut(**data)


@router.post("/password/reset", response_model=MessageOut)
def password_reset(
    body: PasswordResetIn, request: Request, db: DbDep, cid: CorrelationId
) -> MessageOut:
    auth_flow.reset_password(
        db,
        token=body.token,
        new_password=body.password,
        ip=client_ip(request),
        correlation_id=cid,
    )
    return MessageOut(message="Пароль обновлён")


@router.post("/contacts/email/start", response_model=EmailActionOut)
def contacts_email_start(
    body: LinkEmailIn, request: Request, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> EmailActionOut:
    data = auth_flow.start_link_email(
        db, user, email=str(body.email), ip=client_ip(request), correlation_id=cid
    )
    return EmailActionOut(**data)


@router.post("/contacts/email/verify", response_model=UserOut)
def contacts_email_verify(
    body: LinkEmailVerifyIn, request: Request, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> UserOut:
    updated = auth_flow.verify_link_email(
        db, user, token=body.token, ip=client_ip(request), correlation_id=cid
    )
    return _user_out(updated)


@router.post("/contacts/phone/start", response_model=ChallengeStartOut)
def contacts_phone_start(
    body: LinkPhoneIn, request: Request, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> ChallengeStartOut:
    data = auth_flow.start_link_phone(
        db, user, phone_raw=body.phone, ip=client_ip(request), correlation_id=cid
    )
    return ChallengeStartOut(**data)


@router.post("/contacts/phone/verify", response_model=UserOut)
def contacts_phone_verify(
    body: LinkPhoneVerifyIn, request: Request, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> UserOut:
    updated = auth_flow.verify_link_phone(
        db,
        user,
        challenge_id=body.challenge_id,
        code=body.code,
        ip=client_ip(request),
        correlation_id=cid,
    )
    return _user_out(updated)
