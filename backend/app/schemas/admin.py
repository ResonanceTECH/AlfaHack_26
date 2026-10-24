from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.core.enums import GoalType, LegalForm, MemberRole, ProductStatus, ProductType, ScheduleType, UserRole, UserStatus
from app.core.money import Money
from app.schemas.common import APIModel
from app.schemas.credit import CreditProductRuleOut, FeeOut


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


class AdminCreditProductVersionOut(APIModel):
    id: str
    product_id: str | None = None
    version: int
    changelog: str | None = None
    created_by: str | None = None
    created_at: datetime | None = None
    snapshot: dict[str, Any] = Field(default_factory=dict)


class AdminCreditProductOut(APIModel):
    id: str
    code: str | None = None
    name: str
    type: ProductType
    description: str = ""
    amount_min: Money
    amount_max: Money
    term_min: int
    term_max: int
    term_min_months: int | None = None
    term_max_months: int | None = None
    rate_min: Money
    rate_max: Money
    annual_rate_percent: Money | None = None
    currency: str = "RUB"
    collateral_required: bool = False
    legal_forms: list[LegalForm | str] = Field(default_factory=list)
    min_business_age_months: int = 0
    suitable_goals: list[GoalType | str] = Field(default_factory=list)
    purpose_codes: list[GoalType | str] = Field(default_factory=list)
    documents: list[str] = Field(default_factory=list)
    fees: list[FeeOut | dict] = Field(default_factory=list)
    schedule_types: list[ScheduleType | str] = Field(default_factory=list)
    features: list = Field(default_factory=list)
    eligibility_rules: dict = Field(default_factory=dict)
    requirements: dict = Field(default_factory=dict)
    rules: list[CreditProductRuleOut] = Field(default_factory=list)
    status: ProductStatus
    version: int = 1
    is_active: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
    versions: list[AdminCreditProductVersionOut] = Field(default_factory=list)


class AdminCreditProductListOut(APIModel):
    items: list[AdminCreditProductOut]
    total: int = 0


class AdminCreditProductCreate(APIModel):
    code: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    type: ProductType
    description: str = ""
    amount_min: Money
    amount_max: Money
    term_min: int | None = Field(default=None, ge=1, le=360)
    term_max: int | None = Field(default=None, ge=1, le=360)
    term_min_months: int | None = Field(default=None, ge=1, le=360)
    term_max_months: int | None = Field(default=None, ge=1, le=360)
    rate_min: Money | None = None
    rate_max: Money | None = None
    annual_rate_percent: Money | None = None
    currency: str = "RUB"
    collateral_required: bool = False
    legal_forms: list[LegalForm | str] = Field(default_factory=list)
    min_business_age_months: int = Field(default=0, ge=0)
    suitable_goals: list[GoalType | str] = Field(default_factory=list)
    purpose_codes: list[GoalType | str] = Field(default_factory=list)
    documents: list[str] = Field(default_factory=list)
    fees: list[dict] = Field(default_factory=list)
    schedule_types: list[ScheduleType | str] = Field(default_factory=lambda: [ScheduleType.ANNUITY])
    features: list = Field(default_factory=list)
    eligibility_rules: dict = Field(default_factory=dict)
    requirements: dict | None = None


class AdminCreditProductPatch(APIModel):
    code: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: ProductType | None = None
    description: str | None = None
    amount_min: Money | None = None
    amount_max: Money | None = None
    term_min: int | None = Field(default=None, ge=1, le=360)
    term_max: int | None = Field(default=None, ge=1, le=360)
    term_min_months: int | None = Field(default=None, ge=1, le=360)
    term_max_months: int | None = Field(default=None, ge=1, le=360)
    rate_min: Money | None = None
    rate_max: Money | None = None
    annual_rate_percent: Money | None = None
    currency: str | None = None
    collateral_required: bool | None = None
    legal_forms: list[LegalForm | str] | None = None
    min_business_age_months: int | None = Field(default=None, ge=0)
    suitable_goals: list[GoalType | str] | None = None
    purpose_codes: list[GoalType | str] | None = None
    documents: list[str] | None = None
    fees: list[dict] | None = None
    schedule_types: list[ScheduleType | str] | None = None
    features: list | None = None
    eligibility_rules: dict | None = None


class AdminCreditProductPublishIn(APIModel):
    changelog: str | None = Field(default=None, max_length=2000)
