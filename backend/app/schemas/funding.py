from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import Field, field_validator, model_validator

from app.core.enums import GoalType
from app.core.money import Money
from app.schemas.common import APIModel


GOAL_CATALOG: list[dict] = [
    {
        "code": GoalType.INVENTORY_PURCHASE,
        "title": "Закупка товара / запасов",
        "description": "Финансирование оборотных запасов и сезонных закупок",
        "typical_products": ["working_capital", "credit_line", "overdraft"],
    },
    {
        "code": GoalType.NEW_POINT,
        "title": "Открытие новой точки",
        "description": "Аренда, ремонт, первоначальные затраты на точку продаж",
        "typical_products": ["investment", "credit_line"],
    },
    {
        "code": GoalType.EQUIPMENT,
        "title": "Оборудование",
        "description": "Покупка или модернизация основных средств",
        "typical_products": ["investment"],
    },
    {
        "code": GoalType.PRODUCTION_EXPANSION,
        "title": "Расширение производства",
        "description": "Увеличение мощностей и масштабирование",
        "typical_products": ["investment", "credit_line"],
    },
    {
        "code": GoalType.CASH_GAP,
        "title": "Кассовый разрыв",
        "description": "Краткосрочное покрытие разрыва ликвидности",
        "typical_products": ["overdraft", "working_capital"],
    },
    {
        "code": GoalType.OTHER,
        "title": "Другое",
        "description": "Иная бизнес-цель",
        "typical_products": ["working_capital", "credit_line", "investment", "overdraft"],
    },
]


class BusinessGoalCatalogItem(APIModel):
    code: GoalType
    title: str
    description: str
    typical_products: list[str] = Field(default_factory=list)


class FundingNeedItemIn(APIModel):
    name: str = Field(min_length=1, max_length=255)
    amount: Money = Field(gt=0)
    quantity: int = Field(default=1, ge=1)
    unit: str | None = Field(default=None, max_length=64)
    meta: dict = Field(default_factory=dict)


class FundingNeedItemUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Money | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, ge=1)
    unit: str | None = Field(default=None, max_length=64)
    meta: dict | None = None


class FundingNeedItemOut(APIModel):
    id: str
    need_id: str
    name: str
    amount: Money
    quantity: int
    unit: str | None = None
    meta: dict = Field(default_factory=dict)
    created_at: datetime


class FundingNeedCreate(APIModel):
    goal_type: GoalType
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    costs: dict[str, Money] = Field(default_factory=dict)
    items: list[FundingNeedItemIn] = Field(default_factory=list)
    reserve: Money = Decimal("0")
    own_funds: Money = Decimal("0")
    other_funding: Money = Decimal("0")
    required_amount: Money | None = None
    target_date: date | None = None
    term_months: int = Field(default=12, ge=1, le=120)
    urgency: str = "MEDIUM"
    currency: str = "RUB"

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def need_budget_source(self) -> FundingNeedCreate:
        if not self.costs and not self.items and self.required_amount is None:
            raise ValueError("Укажите costs, items или required_amount")
        return self


class FundingNeedUpdate(APIModel):
    goal_type: GoalType | None = None
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    costs: dict[str, Money] | None = None
    items: list[FundingNeedItemIn] | None = None
    reserve: Money | None = None
    own_funds: Money | None = None
    other_funding: Money | None = None
    required_amount: Money | None = None
    target_date: date | None = None
    term_months: int | None = Field(default=None, ge=1, le=120)
    urgency: str | None = None
    status: str | None = None
    currency: str | None = None


class FundingNeedOut(APIModel):
    id: str
    company_id: str
    goal_type: GoalType
    title: str
    description: str | None = None
    costs: dict[str, Money] = Field(default_factory=dict)
    items: list[FundingNeedItemOut] = Field(default_factory=list)
    reserve: Money
    own_funds: Money
    other_funding: Money
    required_amount: Money
    target_date: date | None = None
    term_months: int
    urgency: str = "MEDIUM"
    status: str = "ACTIVE"
    currency: str = "RUB"
    created_at: datetime
    updated_at: datetime | None = None
