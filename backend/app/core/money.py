from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Annotated, Any

from pydantic import BeforeValidator, PlainSerializer

TWOPLACES = Decimal("0.01")


def parse_money(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        amount = value
    elif isinstance(value, bool):
        raise ValueError("Некорректная денежная сумма")
    elif isinstance(value, (int, float, str)):
        try:
            amount = Decimal(str(value).strip().replace(",", "."))
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("Некорректная денежная сумма") from exc
    else:
        raise ValueError("Некорректная денежная сумма")
    return amount.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def format_money(value: Decimal) -> str:
    quantized = value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    return f"{quantized:.2f}"


Money = Annotated[
    Decimal,
    BeforeValidator(parse_money),
    PlainSerializer(format_money, return_type=str, when_used="always"),
]
