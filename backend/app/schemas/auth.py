from __future__ import annotations

from pydantic import Field

from app.core.enums import UserRole, UserStatus
from app.schemas.common import APIModel


class LoginRequest(APIModel):
    login: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(APIModel):
    refresh_token: str | None = None


class UserOut(APIModel):
    id: str
    email: str | None = None
    phone: str | None = None
    full_name: str
    display_name: str | None = None
    role: UserRole
    company_id: str | None = None
    permissions: list[str] = Field(default_factory=list)
    status: UserStatus = UserStatus.ACTIVE


class AuthSessionOut(APIModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    user: UserOut
    redirect_to: str


class TokenPairOut(APIModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
