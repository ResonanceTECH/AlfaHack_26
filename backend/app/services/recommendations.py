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

        legal_forms = list(p.legal_forms or [])
        suitable = list(p.suitable_goals or [])
        legal_val = (
            company.legal_form.value
            if hasattr(company.legal_form, "value")
            else str(company.legal_form)
        )
        legal_ok = legal_val in legal_forms or company.legal_form in legal_forms
        age_ok = age >= int(p.min_business_age_months or 0)
        p_min = Decimal(str(p.amount_min))
        p_max = Decimal(str(p.amount_max))
        amount_ok = p_min <= amount <= p_max
        term_ok = int(p.term_min) <= term_months <= int(p.term_max)

        # Soft ranking: never drop products from the catalog in demo —
        # clamp amount/term into product band and mark mismatches as warnings.
        reasons: list[str] = []
        warnings: list[str] = ["Условия требуют подтверждения банком"]
        score = 0.42
        eligible = True

        if not legal_ok:
            eligible = False
            score -= 0.2
            warnings.append(f"Юрформа {legal_val} не в типовом списке продукта")
        if not age_ok:
            eligible = False
            score -= 0.12
            warnings.append(
                f"Возраст бизнеса ниже ориентира продукта ({p.min_business_age_months} мес.)"
            )

        rec_amount = amount
        if amount < p_min:
            eligible = False
            score -= 0.08
            rec_amount = p_min
            warnings.append(f"Сумма ниже минимума продукта — ориентир от {p_min:,.0f} ₽")
        elif amount > p_max:
            eligible = False
            score -= 0.08
            rec_amount = p_max
            warnings.append(f"Сумма выше лимита — ориентир до {p_max:,.0f} ₽")

        rec_term = term_months
        if term_months < int(p.term_min):
            eligible = False
            score -= 0.05
            rec_term = int(p.term_min)
            warnings.append(f"Срок короче минимума — ориентир от {p.term_min} мес.")
        elif term_months > int(p.term_max):
            eligible = False
            score -= 0.05
            rec_term = int(p.term_max)
            warnings.append(f"Срок длиннее максимума — ориентир до {p.term_max} мес.")
        else:
            score += 0.1
            reasons.append("Срок соответствует условиям продукта")

        goal_ok = goal_val in suitable
        if goal_ok:
            score += 0.25
            reasons.append(f"Подходит для цели «{GOAL_LABELS.get(goal_val, goal_val)}»")
        else:
            score -= 0.08
            warnings.append("Цель финансирования не типична для продукта")

        rate = (Decimal(str(p.rate_min)) + Decimal(str(p.rate_max))) / 2
        payment = annuity_payment(rec_amount, rate, rec_term)
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
            score -= 0.12
            warnings.append("Расчётный платёж превышает свободный денежный поток")

        if not p.collateral_required:
            score += 0.05
            reasons.append("Без обязательного залога на этапе предскоринга")
        else:
            warnings.append("Потребуется залог — условия уточняются банком")

        if amount_ok and term_ok and legal_ok and age_ok:
            score += 0.05

        score = max(0.08, min(0.98, score))
        product_type = p.type.value if hasattr(p.type, "value") else p.type

        recommendations.append(
            {
                "product_id": p.id,
                "product_type": product_type,
                "product_name": p.name,
                "match_score": float(round2(Decimal(str(score)))),
                "eligible_by_basic_rules": eligible and amount_ok and term_ok and legal_ok and age_ok,
                "estimated_monthly_payment": round2(payment),
                "estimated_rate": round2(rate),
                "recommended_amount": rec_amount,
                "recommended_term": rec_term,
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
