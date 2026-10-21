from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

TWOPLACES = Decimal("0.01")


def _d(v: Decimal | float | int | str) -> Decimal:
    return Decimal(str(v))


def round2(v: Decimal | float) -> Decimal:
    return _d(v).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def calc_required_amount(
    costs: dict[str, Decimal | float | int],
    reserve: Decimal,
    own_funds: Decimal,
    other_funding: Decimal,
) -> Decimal:
    costs_sum = sum((_d(v) for v in costs.values()), Decimal("0"))
    return max(Decimal("0"), round2(costs_sum + _d(reserve) - _d(own_funds) - _d(other_funding)))
