from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.core.enums import GoalType, LegalForm
from app.schemas.common import APIModel

class CompanyOut(APIModel):
    id: str
    inn: str
    name: str
    legal_form: LegalForm
    ogrn: str
    industry: str
    registration_date: date
    region: str
    employees_count: int


class CompanyCreate(APIModel):
    inn: str = Field(min_length=10, max_length=12)
    name: str = Field(min_length=2, max_length=512)
    legal_form: LegalForm
    industry: str = Field(min_length=2, max_length=255)
    registration_date: date
    region: str = Field(min_length=2, max_length=255)
    ogrn: str | None = Field(default=None, min_length=13, max_length=15)
    employees_count: int = Field(default=1, ge=0)

    @field_validator("inn")
    @classmethod
    def inn_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("ИНН должен содержать только цифры")
        if len(v) not in (10, 12):
            raise ValueError("ИНН: 10 цифр (ООО) или 12 (ИП)")
        return v


class CompanyUpdate(APIModel):
    name: str | None = None
    industry: str | None = None
    region: str | None = None
    employees_count: int | None = Field(default=None, ge=0)
    ogrn: str | None = None
    registration_date: date | None = None

    @field_validator("employees_count")
    @classmethod
    def non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("Число сотрудников не может быть отрицательным")
        return v

class FinancialSnapshotOut(APIModel):
    id: str
    company_id: str
    period: str
    avg_monthly_revenue: Decimal
    operating_expenses: Decimal
    cash_balance: Decimal
    liabilities: Decimal
    active_credits: Decimal
    source: str
    confirmed: bool
    updated_at: datetime

class FinancialSnapshotUpdate(APIModel):
    period: str | None = None
    avg_monthly_revenue: Decimal | None = None
    operating_expenses: Decimal | None = None
    cash_balance: Decimal | None = None
    liabilities: Decimal | None = None
    active_credits: Decimal | None = None
    source: str | None = None
    confirmed: bool | None = None

class ObligationOut(APIModel):
    id: str
    company_id: str
    type: str
    title: str
    amount: Decimal
    due_date: date
    recurring: bool
    status: str
    currency: str = "RUB"

class ObligationCreate(APIModel):
    type: str
    title: str
    amount: Decimal = Field(gt=0)
    due_date: date
    recurring: bool = False
    status: str = "planned"
    currency: str = "RUB"
    company_id: str | None = None

class ObligationUpdate(APIModel):
    type: str | None = None
    title: str | None = None
    amount: Decimal | None = None
    due_date: date | None = None
    recurring: bool | None = None
    status: str | None = None

class BusinessGoalCreate(APIModel):
    company_id: str
    goal_type: GoalType
    title: str
    description: str | None = None
    costs: dict[str, Decimal] = Field(default_factory=dict)
    reserve: Decimal = Decimal("0")
    own_funds: Decimal = Decimal("0")
    other_funding: Decimal = Decimal("0")
    target_date: date
    term_months: int = Field(ge=1, le=120)

class BusinessGoalOut(APIModel):
    id: str
    company_id: str
    goal_type: GoalType
    title: str
    description: str | None = None
    costs: dict[str, Decimal]
    reserve: Decimal
    own_funds: Decimal
    other_funding: Decimal
    required_amount: Decimal
    target_date: date
    term_months: int
    created_at: datetime
