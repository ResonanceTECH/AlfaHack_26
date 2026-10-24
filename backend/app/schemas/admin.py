from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.core.enums import MemberRole, UserRole, UserStatus
from app.schemas.common import APIModel


class AdminUserOut(APIModel):
    id: str
    login: str | None = None
    email: str | None = None
    phone: str | None = None
    full_name: str
    role: UserRole
    status: UserStatus
    is_active: bool = True
    permissions: list[str] = Field(default_factory=list)
    company_ids: list[str] = Field(default_factory=list)
    last_login_at: datetime | None = None
    created_at: datetime | None = None


class AdminUserListOut(APIModel):
    items: list[AdminUserOut]
    total: int = 0


class AdminUserCreate(APIModel):
    login: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=6, max_length=256)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.ENTREPRENEUR
    status: UserStatus = UserStatus.ACTIVE


class AdminUserPatch(APIModel):
    login: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    status: UserStatus | None = None
    is_active: bool | None = None


class AdminResetCredentialsIn(APIModel):
    password: str = Field(min_length=6, max_length=256)


class AdminResetCredentialsOut(APIModel):
    user_id: str
    message: str = "Учётные данные обновлены, сессии отозваны"


class AdminDisableOut(APIModel):
    user_id: str
    status: UserStatus
    is_active: bool
    sessions_revoked: int = 0


class AdminRoleOut(APIModel):
    role: UserRole
    title: str
    description: str
    permissions: list[str] = Field(default_factory=list)


class AdminPermissionOut(APIModel):
    code: str
    title: str


class AdminCompanyBrief(APIModel):
    id: str
    inn: str
    name: str
    legal_form: str
    registry_status: str
    region: str | None = None
    members_count: int = 0


class AdminCompanyListOut(APIModel):
    items: list[AdminCompanyBrief]
    total: int = 0


class AdminMemberOut(APIModel):
    user_id: str
    company_id: str
    role: MemberRole | str
    full_name: str | None = None
    email: str | None = None
    login: str | None = None
    user_role: UserRole | None = None
    permissions: dict = Field(default_factory=dict)
    created_at: datetime | None = None


class AdminMemberPut(APIModel):
    role: MemberRole = MemberRole.MEMBER
    permissions: dict | None = None
