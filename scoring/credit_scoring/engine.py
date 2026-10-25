"""Скоринговый движок: чистая функция score(input, config) -> result.

Три слоя: стоп-правила -> скоркарта -> кредитная политика.
Без LLM, без побочных эффектов, один и тот же вызов обслуживает и /preview, и итоговое решение.
"""
from __future__ import annotations

import math
import operator
from dataclasses import replace
from typing import Any, Optional

from .config import load_config
from .models import (
    Decision, FactorContribution, Offer, RuleHit, ScoringInput, ScoringResult,
)

_OPS = {
    "eq": operator.eq, "ne": operator.ne,
    "lt": operator.lt, "lte": operator.le,
    "gt": operator.gt, "gte": operator.ge,
}
AMOUNT_STEP = 10_000
CAP_RATIO = 99.0  # условная «бесконечность» для отношений при нулевой выручке


def compute_features(inp: ScoringInput, cfg: dict[str, Any]) -> dict[str, Any]:
    eg, fin, bki, fns, app = inp.egrul, inp.financials, inp.bki, inp.fns, inp.application
    reg, today = eg.registration_date, inp.as_of
    age = (today.year - reg.year) * 12 + (today.month - reg.month) - (1 if today.day < reg.day else 0)

    monthly_revenue = fin.revenue_12m / 12
    growth = fin.revenue_12m / fin.revenue_prev_12m - 1 if age >= 12 and fin.revenue_prev_12m > 0 else None
    margin = (fin.revenue_12m - fin.expenses_12m) / fin.revenue_12m if fin.revenue_12m > 0 else -1.0
    amount_ratio = app.amount / monthly_revenue if monthly_revenue > 0 else CAP_RATIO
    burden = None
    if bki is not None:
        burden = bki.monthly_payments / monthly_revenue if monthly_revenue > 0 else CAP_RATIO

    prefix = eg.okved_main[:2]
    groups = cfg["sector_risk"]["groups"]
    sector = next((g for g, codes in groups.items() if prefix in codes), cfg["sector_risk"]["default"])

    return {
        "egrul_status": eg.status,
        "company_age_months": age,
        "monthly_revenue": monthly_revenue,
        "revenue_growth": growth,
        "profit_margin": margin,
        "amount_to_monthly_revenue": amount_ratio,
        "debt_burden": burden,
        "sector_risk": sector,
        "fns_available": fns is not None,
        "fns_tax_debt": fns.tax_debt if fns else None,
        "fns_unreliable_info": fns.unreliable_info if fns else None,
        "bki_available": bki is not None,
        "bki_overdue_now": bki.overdue_now if bki else None,
        "overdue_count_12m": bki.overdue_count_12m if bki else None,
        "max_overdue_days_12m": bki.max_overdue_days_12m if bki else None,
    }


def evaluate_rules(features: dict[str, Any], cfg: dict[str, Any]) -> list[RuleHit]:
    hits = []
    for r in cfg["stop_rules"]:
        value = features.get(r["feature"])
        if value is None:
            continue
        if _OPS[r["op"]](value, r["value"]):
            hits.append(RuleHit(r["id"], r["description"], r["action"]))
    return hits


def _factor_points(factor: dict[str, Any], value: Any) -> int:
    if factor["type"] == "categorical":
        return factor["map"].get(value, factor["default"])
    for b in factor["bins"]:
        if "lt" not in b or value < b["lt"]:
            return b["points"]
    raise AssertionError("unreachable: last bin has no lt")


def score_factors(features: dict[str, Any], cfg: dict[str, Any]) -> tuple[list[FactorContribution], int, str]:
    contributions, total = [], cfg["base_score"]
    for f in cfg["factors"]:
        value = features.get(f["feature"])
        if value is None:
            contributions.append(FactorContribution(f["id"], f["label"], None, 0, False))
            continue
        pts = _factor_points(f, value)
        total += pts
        shown = round(value, 4) if isinstance(value, float) else value
        contributions.append(FactorContribution(f["id"], f["label"], shown, pts, True))
    # Коррекция распределяется с конца группы: сумма фактических вкладов равна скору.
    for group in cfg.get("factor_groups", []):
        indexes = [i for i, f in enumerate(contributions) if f.id in group["factors"] and f.applied]
        correction = max(0, group["min_points"] - sum(contributions[i].points for i in indexes))
        for i in reversed(indexes):
            f = contributions[i]
            adjustment = min(correction, max(0, -f.points))
            if adjustment:
                contributions[i] = replace(f, points=f.points + adjustment, raw_points=f.points)
                correction -= adjustment
    total = cfg["base_score"] + sum(f.points for f in contributions)
    band = next(b["band"] for b in cfg["risk_bands"] if b["min_score"] is None or total >= b["min_score"])
    return contributions, total, band


def annuity_payment(amount: float, annual_rate: float, term_months: int) -> float:
    r = annual_rate / 12
    return round(amount / term_months if r == 0 else amount * r / (1 - (1 + r) ** -term_months), 2)


def _propose(inp: ScoringInput, product: dict, band_policy: dict, monthly_revenue: float
             ) -> tuple[Optional[Offer], list[str]]:
    """Условия в рамках политики. Возвращает (оффер или None, причины корректировки)."""
    app = inp.application
    limit_amount = min(band_policy["max_amount"], product["max_amount"],
                       band_policy["max_revenue_multiple"] * monthly_revenue)
    limit_term = min(band_policy["max_term_months"], product["max_term_months"])

    reasons, amount, term = [], app.amount, app.term_months
    if amount > limit_amount:
        amount = math.floor(limit_amount / AMOUNT_STEP) * AMOUNT_STEP
        reasons.append("amount_reduced_to_limit")
    if term > limit_term:
        term = limit_term
        reasons.append("term_reduced_to_limit")
    if term < product["min_term_months"]:
        term = product["min_term_months"]
        reasons.append("term_raised_to_product_minimum")
    if amount < product["min_amount"]:
        return None, ["limit_below_product_minimum"]

    rate = band_policy["annual_rate"]
    return Offer(float(amount), term, rate, annuity_payment(amount, rate, term)), reasons


def score(inp: ScoringInput, cfg: Optional[dict[str, Any]] = None) -> ScoringResult:
    cfg = cfg or load_config()
    version = cfg["version"]

    missing = [name for name, val in (("egrul", inp.egrul), ("financials", inp.financials)) if val is None]
    if missing:
        return ScoringResult(Decision.REQUEST_DATA, None, None, None, [], [], missing,
                             [f"missing:{m}" for m in missing], version)

    features = compute_features(inp, cfg)
    hits = evaluate_rules(features, cfg)
    factors, total, band = score_factors(features, cfg)
    product = cfg["products"][inp.application.product.value]

    def result(decision: Decision, offer: Optional[Offer] = None, reasons: Optional[list[str]] = None) -> ScoringResult:
        return ScoringResult(decision, total, band, offer, factors, hits, [], reasons or [], version,
                             score_complete=inp.bki is not None and inp.fns is not None,
                             offer_score=offer_total if offer else None,
                             offer_risk_band=offer_band if offer else None,
                             offer_factors=offer_factors if offer else [])

    offer_total, offer_band = total, band
    offer_factors = factors

    if any(h.action == "reject" for h in hits):
        return result(Decision.REJECTED, reasons=[f"rule:{h.id}" for h in hits if h.action == "reject"])

    if features["company_age_months"] < product["min_company_age_months"]:
        hits = hits + [RuleHit("product_min_age", "Возраст бизнеса меньше минимума для продукта", "reject")]
        return result(Decision.REJECTED, reasons=["rule:product_min_age"])

    band_policy = product["bands"].get(band)
    if band_policy is None:
        return result(Decision.REJECTED, reasons=[f"risk_band_not_served:{band}"])

    offer, reasons = _propose(inp, product, band_policy, features["monthly_revenue"])
    if offer is None:
        return result(Decision.REJECTED, reasons=reasons)

    # Кандидат никогда не увеличивается. Переоценка до устойчивых условий политики.
    while True:
        candidate = replace(inp, application=replace(inp.application, amount=offer.amount,
                                                     term_months=offer.term_months))
        offer_factors, offer_total, offer_band = score_factors(compute_features(candidate, cfg), cfg)
        band_policy = product["bands"].get(offer_band)
        if band_policy is None:
            return result(Decision.REJECTED, reasons=[f"risk_band_not_served:{offer_band}"])
        updated, adjustments = _propose(candidate, product, band_policy, features["monthly_revenue"])
        reasons = list(dict.fromkeys(reasons + adjustments))
        if updated is None:
            return result(Decision.REJECTED, reasons=reasons)
        stable = (updated.amount, updated.term_months) == (offer.amount, offer.term_months)
        offer = updated
        if stable:
            break

    manual_hits = [f"rule:{h.id}" for h in hits if h.action == "manual_review"]
    if manual_hits or not band_policy["auto_approve"]:
        extra = [] if band_policy["auto_approve"] else ["band_requires_manual_review"]
        return result(Decision.MANUAL_REVIEW, offer, manual_hits + extra + reasons)

    return result(Decision.COUNTER_OFFER if reasons else Decision.APPROVED, offer, reasons)
