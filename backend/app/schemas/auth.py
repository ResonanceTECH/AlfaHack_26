from __future__ import annotations

from datetime import date

from pydantic import EmailStr, Field, field_validator, model_validator

from app.core.enums import LegalForm, UserRole, UserStatus
from app.schemas.common import APIModel


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class RegisterCompanyIn(APIModel):
    inn: str = Field(min_length=10, max_length=12)
    name: str = Field(min_length=2, max_length=512)
    legal_form: LegalForm
    ogrn: str = Field(min_length=13, max_length=15)
    industry: str = Field(min_length=2, max_length=255)
    registration_date: date
    region: str = Field(min_length=2, max_length=255)
    employees_count: int = Field(default=0, ge=0)

    @field_validator("inn")
    @classmethod
    def inn_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("ИНН должен содержать только цифры")
        if len(v) not in (10, 12):
            raise ValueError("ИНН: 10 цифр (ООО) или 12 (ИП)")
        return v


class RegisterRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    full_name: str = Field(min_length=2, max_length=255)
    company: RegisterCompanyIn | None = None


class RefreshRequest(APIModel):
    refresh_token: str


class UserOut(APIModel):
    id: str
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str
    role: UserRole
    company_id: str | None = None
    email_verified: bool = False
    phone_verified: bool = False
    status: UserStatus = UserStatus.ACTIVE


class AuthSessionOut(APIModel):
    user: UserOut
    access_token: str
    refresh_token: str


class TokenPairOut(APIModel):
    access_token: str
    refresh_token: str


class PhoneRegisterStartIn(APIModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=10, max_length=32)
    email: EmailStr | None = None
    consent: bool


class PhoneRegisterVerifyIn(APIModel):
    challenge_id: str
    code: str = Field(min_length=4, max_length=10)


class EmailRegisterIn(APIModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    password_confirm: str = Field(min_length=12, max_length=256)
    phone: str | None = None
    consent: bool

    @model_validator(mode="after")
    def passwords_match(self) -> EmailRegisterIn:
        if self.password != self.password_confirm:
            raise ValueError("Пароли не совпадают")
        return self


class EmailResendIn(APIModel):
    email: EmailStr


class PhoneLoginStartIn(APIModel):
    phone: str = Field(min_length=10, max_length=32)


class PhoneLoginVerifyIn(APIModel):
    challenge_id: str
    code: str = Field(min_length=4, max_length=10)


class EmailLoginIn(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class PasswordForgotIn(APIModel):
    email: EmailStr


class PasswordResetIn(APIModel):
    token: str
    password: str = Field(min_length=12, max_length=256)
    password_confirm: str = Field(min_length=12, max_length=256)

    @model_validator(mode="after")
    def passwords_match(self) -> PasswordResetIn:
        if self.password != self.password_confirm:
            raise ValueError("Пароли не совпадают")
        return self


class ChallengeStartOut(APIModel):
    challenge_id: str | None = None
    registration_session_id: str | None = None
    expires_in: int | None = None
    resend_after: int | None = None
    delivery_mode: str | None = None
    destination_masked: str | None = None
    message: str | None = None


class EmailActionOut(APIModel):
    message: str
    delivery_mode: str | None = None
    email_masked: str | None = None
    challenge_id: str | None = None


class LinkEmailIn(APIModel):
    email: EmailStr


class LinkEmailVerifyIn(APIModel):
    token: str


class LinkPhoneIn(APIModel):
    phone: str = Field(min_length=10, max_length=32)


class LinkPhoneVerifyIn(APIModel):
    challenge_id: str
    code: str = Field(min_length=4, max_length=10)
