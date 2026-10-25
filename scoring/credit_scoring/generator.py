"""Генератор синтетических данных (все данные вымышленные, ИНН не проходят проверку контрольной суммы).

personas()        - именованные сценарии для демо и тестов, полностью детерминированы
generate_batch()  - случайные заявки с фиксированным seed, для eval и нагрузки
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, timedelta

from .models import (
    Application, BkiReport, CompanyProfile, EgrulInfo, Financials, FnsInfo, Product, ScoringInput,
)

AS_OF = date(2026, 10, 25)

_NAMES = ["Вектор", "Альтаир", "Меридиан", "Северный путь", "Горизонт", "Орбита", "Кристалл", "Практика",
          "Лидер", "Основа", "Ритм", "Старт", "Эталон", "Навигатор", "Прогресс"]
_SUFFIX = ["Логистика", "Строй", "Сервис", "Торг", "Пищепром", "Софт", "Групп", "Трейд"]
_SURNAMES = ["Иванов", "Петрова", "Сидоров", "Кузнецова", "Смирнов", "Попова", "Морозов", "Волкова"]
_OKVED = ["62.01", "47.11", "56.10", "43.21", "49.41", "10.71", "69.20", "86.90", "41.20", "01.11", "55.10"]


@dataclass(frozen=True)
class Persona:
    id: str
    title: str
    expected_decision: str
    input: ScoringInput


def _months_ago(months: int) -> date:
    y, m = divmod(AS_OF.year * 12 + AS_OF.month - 1 - months, 12)
    return date(y, m + 1, min(AS_OF.day, 28))


def _build(inn, name, org="ООО", *, age=72, okved="62.01", status="active",
           revenue=24_000_000, prev=20_000_000, margin=0.18,
           bki="ok", payments=150_000, overdue_now=False, overdue_cnt=0, overdue_days=0, loans=1,
           fns="ok", tax_debt=False, unreliable=False, fin=True,
           product=Product.WORKING_CAPITAL, amount=3_000_000, term=24, purpose="") -> ScoringInput:
    return ScoringInput(
        company=CompanyProfile(inn, name, org),
        application=Application(product, amount, term, purpose),
        egrul=EgrulInfo(status, _months_ago(age), okved),
        financials=Financials(revenue, prev, round(revenue * (1 - margin))) if fin else None,
        fns=FnsInfo(tax_debt, unreliable) if fns == "ok" else None,
        bki=BkiReport(loans, payments, overdue_now, overdue_cnt, overdue_days) if bki == "ok" else None,
        as_of=AS_OF,
    )


def personas() -> list[Persona]:
    return [
        Persona("ideal", "Идеальный клиент: 6 лет, рост, низкая нагрузка", "approved",
                _build("7700000001", "ООО «Ромашка-Софт»", purpose="Пополнение оборотных средств")),
        Persona("ambitious", "Хороший клиент просит больше лимита", "counter_offer",
                _build("7700000002", "ООО «Вектор-Торг»", age=48, okved="47.11", revenue=12_000_000,
                       prev=10_500_000, margin=0.1333, payments=80_000, amount=9_000_000, term=36)),
        Persona("controversial", "Спорный: налоговая задолженность", "manual_review",
                _build("7700000003", "ООО «Меридиан-Строй»", okved="43.21", tax_debt=True)),
        Persona("overdue", "Текущая просрочка в БКИ", "rejected",
                _build("7700000004", "ИП Петров А.А.", org="ИП", okved="49.41", overdue_now=True,
                       overdue_cnt=2, overdue_days=45)),
        Persona("young", "Молодая компания просит больше лимита", "counter_offer",
                _build("7700000005", "ООО «Старт-Пищепром»", age=8, okved="10.71", revenue=4_000_000,
                       prev=0, margin=0.125, payments=0, loans=0,
                       product=Product.EXPRESS, amount=1_000_000, term=12)),
        Persona("liquidating", "Компания в стадии ликвидации", "rejected",
                _build("7700000006", "ООО «Горизонт-Трейд»", status="liquidating")),
        Persona("incomplete", "Нет финансовых показателей", "request_data",
                _build("7700000007", "ООО «Орбита-Сервис»", fin=False)),
        Persona("bki_down", "Источник БКИ недоступен", "manual_review",
                _build("7700000008", "ООО «Эталон-Логистика»", bki="down")),
    ]


def generate_batch(n: int, seed: int = 42) -> list[ScoringInput]:
    rng = random.Random(seed)
    archetypes = {  # age_months, revenue growth, margin, burden (payments / monthly revenue), overdue chance
        "strong": ((36, 120), (0.1, 0.4), (0.15, 0.3), (0.0, 0.15), 0.02),
        "average": ((18, 72), (-0.05, 0.15), (0.05, 0.15), (0.05, 0.3), 0.15),
        "weak": ((6, 48), (-0.4, 0.0), (-0.05, 0.06), (0.25, 0.7), 0.5),
        "young": ((3, 11), (None, None), (0.0, 0.2), (0.0, 0.2), 0.05),
    }
    out = []
    for i in range(n):
        arch = rng.choices(list(archetypes), weights=[0.3, 0.4, 0.2, 0.1])[0]
        (a0, a1), (g0, g1), (m0, m1), (b0, b1), p_overdue = archetypes[arch]
        age = rng.randint(a0, a1)
        revenue = round(rng.lognormvariate(16.0, 0.9), -3)
        prev = 0 if age < 12 or g0 is None else round(revenue / (1 + rng.uniform(g0, g1)), -3)
        monthly = revenue / 12
        is_ip = rng.random() < 0.35
        overdue = rng.random() < p_overdue
        product = rng.choice(list(Product))
        amount = min(max(round(monthly * rng.uniform(0.5, 8), -4), 100_000), 30_000_000)
        inn = "".join(rng.choices("0123456789", k=12 if is_ip else 10))
        name = f"ИП {rng.choice(_SURNAMES)} {rng.choice('АБВГДЕ')}.{rng.choice('АБВГДЕ')}." if is_ip \
            else f"ООО «{rng.choice(_NAMES)}-{rng.choice(_SUFFIX)}»"
        # крайние случаи: пропуски, недоступные источники, ликвидация
        liquidating = rng.random() < 0.02
        out.append(_build(
            inn, name, "ИП" if is_ip else "ООО", age=age, okved=rng.choice(_OKVED),
            status="liquidating" if liquidating else "active",
            revenue=revenue, prev=prev, margin=rng.uniform(m0, m1),
            bki="down" if rng.random() < 0.04 else "ok",
            payments=round(monthly * rng.uniform(b0, b1), -3), loans=rng.randint(0, 4),
            overdue_now=overdue and rng.random() < 0.3, overdue_cnt=rng.randint(1, 4) if overdue else 0,
            overdue_days=rng.choice([5, 14, 35, 70]) if overdue else 0,
            fns="down" if rng.random() < 0.02 else "ok",
            tax_debt=rng.random() < 0.05, unreliable=rng.random() < 0.03,
            fin=rng.random() >= 0.03,
            product=product, amount=amount, term=rng.choice([6, 12, 24, 36, 48]),
        ))
    return out
