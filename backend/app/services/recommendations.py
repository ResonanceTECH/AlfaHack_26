from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from app.core.enums import GoalType
from app.services.finance_engine import annuity_payment, round2
from app.services.ml_client import ml_enabled, recommend_via_ml

MODEL_VERSION = "demo-rules-v1"

GOAL_LABELS: dict[str, str] = {
    "inventory_purchase": "Закупка товаров",
    "new_point": "Открытие точки",
    "equipment": "Покупка оборудования",
    "production_expansion": "Расширение производства",
    "cash_gap": "Кассовый разрыв",
    "other": "Другая цель",
}

def business_age_months(registration_date: date, today: date | None = None) -> int:
    today = today or date.today()
    return (today.year - registration_date.year) * 12 + (today.month - registration_date.month)

def rank_products(
    *,
    company: Any,
    financials: Any,
    goal_type: GoalType | str,
    amount: Decimal,
    term_months: int,
    products: list[Any],
) -> dict[str, Any]:
    goal_val = goal_type.value if isinstance(goal_type, GoalType) else goal_type
    age = business_age_months(company.registration_date)

    if ml_enabled():
        legal = company.legal_form.value if hasattr(company.legal_form, "value") else company.legal_form
        payload = {
            "company_id": company.id,
            "business_goal": goal_val,
            "requested_amount": str(amount),
            "requested_term_months": term_months,
            "industry": getattr(company, "industry", None),
            "company_age_months": age,
            "legal_form": legal,
            "monthly_inflow": str(financials.avg_monthly_revenue),
            "monthly_outflow": str(financials.operating_expenses),
            "cash_balance": str(financials.cash_balance),
            "existing_debt_payments": str(Decimal(str(financials.active_credits)) * Decimal("0.05")),
            "collateral_available": False,
            "products": [
                {
                    "id": p.id,
                    "name": p.name,
                    "type": p.type.value if hasattr(p.type, "value") else p.type,
                    "amount_min": str(p.amount_min),
                    "amount_max": str(p.amount_max),
                    "term_min": p.term_min,
                    "term_max": p.term_max,
                    "rate_min": str(p.rate_min),
                    "rate_max": str(p.rate_max),
                    "collateral_required": p.collateral_required,
                    "legal_forms": list(p.legal_forms or []),
                    "min_business_age_months": p.min_business_age_months,
                    "suitable_goals": list(p.suitable_goals or []),
                    "documents": list(p.documents or []),
                    "is_active": getattr(p, "is_active", True),
                }
                for p in products
            ],
        }
        remote = recommend_via_ml(payload)
        if remote is not None:
            return remote

    recommendations: list[dict[str, Any]] = []

    for p in products:
        if not getattr(p, "is_active", True):
            continue

        legal_forms = p.legal_forms or []
        suitable = p.suitable_goals or []
        legal_ok = company.legal_form.value in legal_forms or company.legal_form in legal_forms
        age_ok = age >= p.min_business_age_months
        amount_ok = Decimal(str(p.amount_min)) <= amount <= Decimal(str(p.amount_max))
        term_ok = p.term_min <= term_months <= p.term_max

        if not (legal_ok and age_ok and amount_ok and term_ok):
            continue

        reasons: list[str] = []
        warnings: list[str] = ["Условия требуют подтверждения банком"]
        score = 0.4

        goal_ok = goal_val in suitable
        if goal_ok:
            score += 0.25
            reasons.append(f"Подходит для цели «{GOAL_LABELS.get(goal_val, goal_val)}»")
        else:
            score -= 0.1
            warnings.append("Цель финансирования не типична для продукта")

        if term_ok:
            score += 0.1
            reasons.append("Срок соответствует бизнес-цели")

        rate = (Decimal(str(p.rate_min)) + Decimal(str(p.rate_max))) / 2
        payment = annuity_payment(amount, rate, min(term_months, p.term_max))
        free_cash = (
            Decimal(str(financials.avg_monthly_revenue))
            - Decimal(str(financials.operating_expenses))
            - Decimal(str(financials.active_credits)) * Decimal("0.05")
        )
        if payment <= free_cash * Decimal("0.7"):
            score += 0.2
            reasons.append("Платёж укладывается в заданный лимит нагрузки")
        elif payment <= free_cash:
            score += 0.08
            warnings.append("Нагрузка близка к пределу свободного денежного потока")
        else:
            score -= 0.15
            warnings.append("Расчётный платёж превышает свободный денежный поток")

        if not p.collateral_required:
            score += 0.05
            reasons.append("Без обязательного залога на этапе предскоринга")
        else:
            warnings.append("Потребуется залог — условия уточняются банком")

        score = max(0.05, min(0.98, score))
        product_type = p.type.value if hasattr(p.type, "value") else p.type

        recommendations.append(
            {
                "product_id": p.id,
                "product_type": product_type,
                "product_name": p.name,
                "match_score": float(round2(Decimal(str(score)))),
                "eligible_by_basic_rules": True,
                "estimated_monthly_payment": round2(payment),
                "estimated_rate": round2(rate),
                "recommended_amount": amount,
                "recommended_term": min(max(term_months, p.term_min), p.term_max),
                "reasons": reasons,
                "warnings": warnings,
            }
        )

    recommendations.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "company_id": company.id,
        "business_goal": goal_val,
        "requested_amount": amount,
        "currency": "RUB",
        "recommendations": recommendations,
        "is_official_offer": False,
        "model_version": MODEL_VERSION,
    }
