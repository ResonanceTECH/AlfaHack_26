from __future__ import annotations

import math
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import uuid4

from dateutil.relativedelta import relativedelta

TWOPLACES = Decimal("0.01")

def _d(v: Decimal | float | int | str) -> Decimal:
    return Decimal(str(v))

def round2(v: Decimal | float) -> Decimal:
    return _d(v).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

def add_months(start: date, months: int) -> date:
    return start + relativedelta(months=months)

def annuity_payment(principal: Decimal, annual_rate: Decimal, term_months: int) -> Decimal:
    if term_months <= 0:
        return Decimal("0")
    r = annual_rate / Decimal("100") / Decimal("12")
    if r == 0:
        return round2(principal / term_months)
    factor = (1 + r) ** term_months
    return round2(principal * r * factor / (factor - 1))

def calc_required_amount(
    costs: dict[str, Decimal | float | int],
    reserve: Decimal,
    own_funds: Decimal,
    other_funding: Decimal,
) -> Decimal:
    costs_sum = sum((_d(v) for v in costs.values()), Decimal("0"))
    return max(Decimal("0"), round2(costs_sum + _d(reserve) - _d(own_funds) - _d(other_funding)))

def build_payment_schedule(
    *,
    amount: Decimal,
    term_months: int,
    annual_rate: Decimal,
    schedule_type: str,
    start_date: date,
    fees_percent: Decimal = Decimal("0"),
    fees_fixed: Decimal = Decimal("0"),
) -> dict[str, Any]:
    amount = _d(amount)
    annual_rate = _d(annual_rate)
    fees_percent = _d(fees_percent)
    fees_fixed = _d(fees_fixed)
    r = annual_rate / Decimal("100") / Decimal("12")
    rows: list[dict[str, Any]] = []
    balance = amount
    total_payment = Decimal("0")
    total_interest = Decimal("0")
    total_fees = Decimal("0")
    upfront_fee = round2(amount * fees_percent / Decimal("100") + fees_fixed)
    monthly_annuity = annuity_payment(amount, annual_rate, term_months)
    principal_part = amount / term_months if term_months else Decimal("0")

    for m in range(1, term_months + 1):
        interest = round2(balance * r)
        fee = upfront_fee if m == 1 else Decimal("0")
        if schedule_type == "annuity":
            if m == term_months:
                principal = balance
                payment = round2(principal + interest)
            else:
                payment = monthly_annuity
                principal = round2(min(payment - interest, balance))
                payment = round2(principal + interest)
        else:
            principal = round2(balance if m == term_months else principal_part)
            payment = round2(principal + interest)

        balance = round2(max(Decimal("0"), balance - principal))
        total_payment += payment + fee
        total_interest += interest
        total_fees += fee
        rows.append(
            {
                "month": m,
                "date": add_months(start_date, m - 1),
                "payment": round2(payment + fee),
                "principal": principal,
                "interest": interest,
                "fees": fee,
                "balance": balance,
            }
        )

    return {
        "schedule_type": schedule_type,
        "amount": amount,
        "term_months": term_months,
        "annual_rate": annual_rate,
        "monthly_payment": monthly_annuity if schedule_type == "annuity" else (rows[0]["payment"] if rows else Decimal("0")),
        "total_payment": round2(total_payment),
        "total_interest": round2(total_interest),
        "total_fees": round2(total_fees),
        "rows": rows,
    }

def run_credit_scenario(name: str, params: dict[str, Any], scenario_id: str | None = None) -> dict[str, Any]:
    schedule = build_payment_schedule(
        amount=_d(params["amount"]),
        term_months=int(params["term_months"]),
        annual_rate=_d(params["annual_rate"]),
        schedule_type=params.get("schedule_type", "annuity"),
        start_date=params["repayment_start_date"]
        if isinstance(params["repayment_start_date"], date)
        else date.fromisoformat(str(params["repayment_start_date"])),
    )
    monthly_payment = schedule["monthly_payment"]
    series: list[dict[str, Any]] = []
    base_rev = _d(params["base_monthly_revenue"])
    base_exp = _d(params["base_monthly_expenses"])
    rev_chg = _d(params.get("revenue_change_pct", 0))
    exp_chg = _d(params.get("expense_change_pct", 0))
    season_pct = _d(params.get("seasonal_swing_pct", 0))
    one_time = _d(params.get("one_time_investment", 0))
    own = _d(params.get("own_funds", 0))

    balance = round2(base_rev * Decimal("0.4") - one_time + own)
    deficit_months: list[int] = []
    term = int(params["term_months"])

    for m in range(1, term + 1):
        season = Decimal("1") + (season_pct / Decimal("100")) * Decimal(
            str(math.sin((m / 12) * math.pi * 2))
        )
        revenue = base_rev * (1 + rev_chg / Decimal("100")) * season
        expenses = base_exp * (1 + exp_chg / Decimal("100"))
        payment = schedule["rows"][m - 1]["payment"] if m - 1 < len(schedule["rows"]) else monthly_payment
        net_flow = round2(revenue - expenses - payment)
        balance = round2(balance + net_flow)
        if balance < 0:
            deficit_months.append(m)
        series.append({"month": m, "balance": balance, "payment": payment, "net_flow": net_flow})

    min_balance = min((s["balance"] for s in series), default=Decimal("0"))
    cash_flow_after = round2(
        base_rev * (1 + rev_chg / Decimal("100")) - base_exp * (1 + exp_chg / Decimal("100")) - monthly_payment
    )
    explanation = (
        "При выбранных параметрах расчётный месячный денежный поток положительный."
        if cash_flow_after >= 0
        else "При выбранных параметрах после платежа остаётся отрицательный денежный поток — "
        "рассмотрите уменьшение суммы или удлинение срока."
    )

    params_out = dict(params)
    for k in ("disbursement_date", "repayment_start_date"):
        if k in params_out and isinstance(params_out[k], date):
            params_out[k] = params_out[k].isoformat()

    return {
        "id": scenario_id or str(uuid4()),
        "name": name,
        "params": params_out,
        "monthly_payment": monthly_payment,
        "cash_flow_after_payment": cash_flow_after,
        "min_balance": round2(min_balance),
        "deficit_months": deficit_months,
        "explanation": explanation,
        "series": series,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

def _npv(rate_monthly: Decimal, cash_flows: list[Decimal]) -> Decimal:
    total = Decimal("0")
    for t, cf in enumerate(cash_flows):
        total += cf / ((1 + rate_monthly) ** t)
    return round2(total)

def _irr_annual(cash_flows: list[Decimal]) -> Decimal | None:
    lo, hi = Decimal("-0.99"), Decimal("5")
    for _ in range(80):
        mid = (lo + hi) / 2
        v = _npv(mid, cash_flows)
        if v > 0:
            lo = mid
        else:
            hi = mid
    rate = (lo + hi) / 2
    annual = ((1 + rate) ** 12 - 1) * 100
    if not math.isfinite(float(annual)):
        return None
    return round2(annual)

def evaluate_project(inp: dict[str, Any]) -> dict[str, Any]:
    credit_amount = _d(inp["credit_amount"])
    credit_rate = _d(inp["credit_rate"])
    credit_term = int(inp["credit_term_months"])
    horizon = int(inp["horizon_months"])
    discount_rate = _d(inp.get("discount_rate", 12))
    tax_rate = _d(inp.get("tax_rate", 0))
    additional_sales = _d(inp["additional_sales"])
    variable_costs = _d(inp["variable_costs"])
    fixed_costs = _d(inp["fixed_costs"])
    residual = _d(inp.get("residual_value", 0))
    initial = _d(inp["initial_investment"])

    monthly_debt = annuity_payment(credit_amount, credit_rate, credit_term)
    discount_monthly = discount_rate / Decimal("100") / Decimal("12")

    cash_flows_raw: list[Decimal] = []
    table: list[dict[str, Any]] = []
    initial_out = -initial
    cash_flows_raw.append(initial_out)
    table.append({"month": 0, "cf": initial_out, "cumulative": initial_out, "discounted": initial_out})

    cumulative = initial_out
    discounted_cum = initial_out
    simple_payback: int | None = None
    discounted_payback: int | None = None

    for m in range(1, horizon + 1):
        ebit = additional_sales - variable_costs - fixed_costs
        tax = max(Decimal("0"), ebit) * tax_rate / Decimal("100")
        debt = monthly_debt if m <= credit_term else Decimal("0")
        res = residual if m == horizon else Decimal("0")
        cf = round2(ebit - tax - debt + res)
        cash_flows_raw.append(cf)
        cumulative = round2(cumulative + cf)
        discounted = round2(cf / ((1 + discount_monthly) ** m))
        discounted_cum = round2(discounted_cum + discounted)
        if simple_payback is None and cumulative >= 0:
            simple_payback = m
        if discounted_payback is None and discounted_cum >= 0:
            discounted_payback = m
        table.append({"month": m, "cf": cf, "cumulative": cumulative, "discounted": discounted_cum})

    total_in = sum((max(Decimal("0"), r["cf"]) for r in table[1:]), Decimal("0"))
    roi = (
        round2(((total_in + residual) / initial - 1) * 100) if initial > 0 else Decimal("0")
    )
    contribution = additional_sales - variable_costs
    break_even = None
    if contribution > 0 and additional_sales > 0:
        unit_contrib = contribution / max(Decimal("1"), additional_sales / Decimal("100"))
        break_even = round2((fixed_costs + monthly_debt) / unit_contrib)

    return {
        "simple_payback_months": simple_payback,
        "discounted_payback_months": discounted_payback,
        "npv": _npv(discount_monthly, cash_flows_raw),
        "irr": _irr_annual(cash_flows_raw),
        "roi": roi,
        "break_even_units": break_even,
        "cash_flows": table,
    }
