"""Контракт скоринга: входные и выходные структуры.

Только стандартные dataclasses: FastAPI / pydantic v2 принимают их без обёрток.
Все суммы в рублях, сроки в месяцах, ставки годовые (0.18 = 18%).
"""
from __future__ import annotations

import dataclasses
import math
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any, Optional


class Product(str, Enum):
    WORKING_CAPITAL = "working_capital"
    OVERDRAFT = "overdraft"
    EQUIPMENT = "equipment"
    EXPRESS = "express"


class Decision(str, Enum):
    APPROVED = "approved"
    COUNTER_OFFER = "counter_offer"  # одобрено на других условиях
    REQUEST_DATA = "request_data"  # нужно уточнение от клиента
    MANUAL_REVIEW = "manual_review"  # маршрут к аналитику банка
    REJECTED = "rejected"


@dataclass(frozen=True)
class CompanyProfile:
    inn: str
    name: str
    org_type: str  # "ООО" | "ИП"


@dataclass(frozen=True)
class Application:
    product: Product
    amount: float
    term_months: int
    purpose: str = ""

    def __post_init__(self) -> None:
        if not math.isfinite(self.amount) or self.amount <= 0:
            raise ValueError("amount must be positive")
        if type(self.term_months) is not int or self.term_months <= 0:
            raise ValueError("term_months must be positive")


@dataclass(frozen=True)
class EgrulInfo:
    status: str  # active | liquidating | liquidated
    registration_date: date
    okved_main: str  # например "62.01"


@dataclass(frozen=True)
class FnsInfo:
    tax_debt: bool
    unreliable_info: bool  # недостоверные сведения (адрес, руководитель)


@dataclass(frozen=True)
class BkiReport:
    active_loans: int
    monthly_payments: float
    overdue_now: bool
    overdue_count_12m: int
    max_overdue_days_12m: int

    def __post_init__(self) -> None:
        for value in (self.active_loans, self.overdue_count_12m, self.max_overdue_days_12m):
            if type(value) is not int or value < 0:
                raise ValueError("BKI counts must be nonnegative integers")
        if not math.isfinite(self.monthly_payments) or self.monthly_payments < 0:
            raise ValueError("monthly_payments must be finite and nonnegative")
        if (self.overdue_count_12m == 0) != (self.max_overdue_days_12m == 0):
            raise ValueError("overdue count and duration must both be zero or both positive")
        if self.overdue_now and self.overdue_count_12m == 0:
            raise ValueError("current overdue requires an overdue in the last 12 months")


@dataclass(frozen=True)
class Financials:
    revenue_12m: float
    revenue_prev_12m: float  # 0, если компании меньше 12 месяцев
    expenses_12m: float

    def __post_init__(self) -> None:
        if any(not math.isfinite(value) or value < 0 for value in
               (self.revenue_12m, self.revenue_prev_12m, self.expenses_12m)):
            raise ValueError("financial amounts must be finite and nonnegative")


@dataclass(frozen=True)
class ScoringInput:
    """None в egrul/financials означает «данных нет» (запрос уточнения).
    None в fns/bki означает «источник недоступен» (ручное рассмотрение)."""

    company: CompanyProfile
    application: Application
    egrul: Optional[EgrulInfo]
    financials: Optional[Financials]
    fns: Optional[FnsInfo] = None
    bki: Optional[BkiReport] = None
    as_of: date = field(default_factory=date.today)

    def __post_init__(self) -> None:
        if self.egrul is not None and self.egrul.registration_date > self.as_of:
            raise ValueError("registration_date must not be after as_of")

    @classmethod
    def from_dict(cls, d: dict) -> "ScoringInput":
        def opt(key: str, factory):
            return factory(**d[key]) if d.get(key) is not None else None

        egrul = None
        if d.get("egrul") is not None:
            e = dict(d["egrul"])
            e["registration_date"] = date.fromisoformat(e["registration_date"])
            egrul = EgrulInfo(**e)
        app = dict(d["application"])
        app["product"] = Product(app["product"])
        return cls(
            company=CompanyProfile(**d["company"]),
            application=Application(**app),
            egrul=egrul,
            financials=opt("financials", Financials),
            fns=opt("fns", FnsInfo),
            bki=opt("bki", BkiReport),
            as_of=date.fromisoformat(d["as_of"]),
        )


@dataclass(frozen=True)
class FactorContribution:
    id: str
    label: str
    value: Any  # значение признака; None, если признак не посчитан
    points: int
    applied: bool  # False, если значения нет и вклад равен 0
    raw_points: Optional[int] = None  # до группового ограничения; points — фактический вклад


@dataclass(frozen=True)
class RuleHit:
    id: str
    description: str
    action: str  # reject | manual_review


@dataclass(frozen=True)
class Offer:
    amount: float
    term_months: int
    annual_rate: float
    monthly_payment: float


@dataclass(frozen=True)
class ScoringResult:
    decision: Decision
    score: Optional[int]
    risk_band: Optional[str]
    offer: Optional[Offer]
    factors: list[FactorContribution]
    rule_hits: list[RuleHit]
    missing_data: list[str]
    reasons: list[str]  # машинные коды причин, для текстов и аналитики
    config_version: str
    score_complete: bool = False  # есть все источники; неприменимые по возрасту признаки допустимы
    offer_score: Optional[int] = None  # скор на предложенных сумме и сроке
    offer_risk_band: Optional[str] = None
    offer_factors: list[FactorContribution] = field(default_factory=list)


def to_jsonable(obj: Any) -> Any:
    """Рекурсивно превращает dataclass/Enum/date в JSON-совместимые типы."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: to_jsonable(getattr(obj, f.name)) for f in dataclasses.fields(obj)}
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    return obj
