from __future__ import annotations

import math
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from app.core.enums import TransactionCategory
from app.services.finance_engine import round2
from app.services.ml_client import forecast_via_ml, ml_enabled

MODEL_VERSION = "seasonal-naive-v1"

def build_cashflow_forecast(
    *,
    transactions: list[Any],
    cash_balance: Decimal,
    horizon_days: int = 90,
    planned_payments: list[dict] | None = None,
    company_id: str | None = None,
) -> dict[str, Any]:
    if horizon_days not in (30, 90, 180):
        horizon_days = 90

    if ml_enabled() and company_id:
        remote = forecast_via_ml(
            company_id=company_id,
            transactions=transactions,
            cash_balance=cash_balance,
            horizon_days=horizon_days,
            planned_payments=planned_payments,
        )
        if remote is not None:
            return remote

    external = [
        t
        for t in transactions
        if getattr(t, "category", None) != TransactionCategory.TRANSFER_INTERNAL
        and (t.category != TransactionCategory.TRANSFER_INTERNAL if hasattr(t, "category") else True)
    ]

    if len(external) < 10:
        quality = "insufficient"
        warning = (
            "Недостаточно исторических данных для ML-прогноза. "
            "Показан сценарный расчёт на базе средних оборотов."
        )
    elif len(external) < 40:
        quality = "limited"
        warning = "Качество данных ограничено — интервал неопределённости расширен."
    else:
        quality = "good"
        warning = None

    inflows = [
        Decimal(str(t.amount))
        for t in external
        if t.direction == "in" and t.category == TransactionCategory.REVENUE
    ]
    outflows = [Decimal(str(t.amount)) for t in external if t.direction == "out"]

    avg_daily_in = (sum(inflows, Decimal("0")) / max(1, len(set(t.date for t in external)))) if external else Decimal("5000")
    avg_daily_out = (sum(outflows, Decimal("0")) / max(1, len(set(t.date for t in external)))) if external else Decimal("4000")

    if avg_daily_in == 0:
        avg_daily_in = Decimal("30000")
    if avg_daily_out == 0:
        avg_daily_out = Decimal("22000")

    planned_by_date: dict[date, Decimal] = {}
    for p in planned_payments or []:
        d = p["date"] if isinstance(p["date"], date) else date.fromisoformat(str(p["date"]))
        planned_by_date[d] = planned_by_date.get(d, Decimal("0")) + Decimal(str(p.get("amount", 0)))

    today = date.today()
    points: list[dict[str, Any]] = []
    balance = Decimal(str(cash_balance))
    min_balance = balance
    cash_gap_amount: Decimal | None = None
    cash_gap_date: date | None = None

    band = Decimal("0.15") if quality == "good" else Decimal("0.35") if quality == "limited" else Decimal("0.5")

    for i in range(horizon_days):
        d = today + timedelta(days=i)
        season = Decimal("1")
        if d.weekday() >= 5:
            season = Decimal("0.4")
        elif d.day <= 5:
            season = Decimal("1.15")
        season *= Decimal("1") + Decimal("0.08") * Decimal(str(math.sin((d.timetuple().tm_yday / 365) * math.pi * 2)))

        pred_in = round2(avg_daily_in * season)
        pred_out = round2(avg_daily_out * (Decimal("1.1") if d.day <= 5 else Decimal("1")))
        pred_out += planned_by_date.get(d, Decimal("0"))
        net = round2(pred_in - pred_out)
        balance = round2(balance + net)
        if balance < min_balance:
            min_balance = balance
        if balance < 0 and cash_gap_date is None:
            cash_gap_date = d
            cash_gap_amount = abs(balance)

        spread = round2(abs(net) * band + Decimal("1000"))
        points.append(
            {
                "date": d,
                "actual_balance": None,
                "predicted_inflow": pred_in,
                "predicted_outflow": pred_out,
                "net_cash_flow": net,
                "closing_balance": balance,
                "lower_bound": round2(balance - spread),
                "upper_bound": round2(balance + spread),
            }
        )

    return {
        "horizon_days": horizon_days,
        "points": points,
        "minimum_balance": round2(min_balance),
        "cash_gap_amount": round2(cash_gap_amount) if cash_gap_amount is not None else None,
        "cash_gap_date": cash_gap_date,
        "data_quality": quality,
        "model_version": MODEL_VERSION,
        "warning": warning,
    }
