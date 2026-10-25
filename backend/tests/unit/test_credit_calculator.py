"""Unit: annuity schedule — independent Decimal reference."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

import pytest

from app.services.finance_engine import annuity_payment, build_payment_schedule, round2

TWOPLACES = Decimal("0.01")


def _annuity_ref(principal: Decimal, annual: Decimal, n: int) -> Decimal:
    if n <= 0:
        return Decimal("0")
    r = annual / Decimal("100") / Decimal("12")
    if r == 0:
        return (principal / n).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    f = (1 + r) ** n
    return (principal * r * f / (f - 1)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


@pytest.mark.parametrize(
    "amount,rate,term",
    [
        (Decimal("1000000"), Decimal("15"), 12),
        (Decimal("2500000"), Decimal("19.5"), 12),
        (Decimal("500000"), Decimal("18.5"), 3),
        (Decimal("1000000"), Decimal("0"), 10),
    ],
)
def test_annuity_matches_reference(amount: Decimal, rate: Decimal, term: int) -> None:
    assert annuity_payment(amount, rate, term) == _annuity_ref(amount, rate, term)


def test_schedule_final_balance_zero_and_principal_sum() -> None:
    raw = build_payment_schedule(
        amount=Decimal("1000000"),
        term_months=12,
        annual_rate=Decimal("15"),
        schedule_type="annuity",
        start_date=date(2026, 1, 1),
    )
    rows = raw["rows"]
    assert rows[-1]["balance"] == Decimal("0.00")
    assert all(r["balance"] >= 0 for r in rows)
    assert sum((r["principal"] for r in rows), Decimal("0")) == Decimal("1000000.00")
    overpay = round2(raw["total_payment"] - Decimal("1000000"))
    assert overpay == round2(raw["total_interest"] + raw["total_fees"])


def test_zero_term() -> None:
    assert annuity_payment(Decimal("1000"), Decimal("10"), 0) == Decimal("0")
