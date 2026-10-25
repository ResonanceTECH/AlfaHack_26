from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from app.services.recommendations import GOAL_LABELS

DISCLAIMER = (
    "Это информационная помощь платформы, а не официальное решение банка "
    "и не гарантия одобрения кредита."
)

def _match_product_mentions(message: str, products: list[Any]) -> list[Any]:
    lower = message.lower()
    found = []
    for p in products:
        if p.name.lower() in lower or p.type.value.replace("_", " ") in lower:
            found.append(p)
        for alias in {
            "working_capital": ["оборотн"],
            "investment": ["инвестицион"],
            "overdraft": ["овердрафт"],
            "credit_line": ["кредитн", "линия", "лимит"],
        }.get(p.type.value, []):
            if alias in lower and p not in found:
                found.append(p)
    return found

def generate_reply(
    *,
    message: str,
    products: list[Any],
    company_name: str | None = None,
    last_recommendations: list[dict] | None = None,
) -> dict[str, Any]:
    lower = message.lower()
    sources: list[str] = []
    actions: list[dict[str, str]] = []
    matched = _match_product_mentions(message, products)

    goal_hints = {
        "inventory_purchase": ["закуп", "товар", "парти"],
        "new_point": ["точк", "открыт", "магазин"],
        "equipment": ["оборудован", "станок"],
        "production_expansion": ["производств", "мощност"],
        "cash_gap": ["кассов", "разрыв", "ликвидн"],
    }
    detected_goal = None
    for g, hints in goal_hints.items():
        if any(h in lower for h in hints):
            detected_goal = g
            break

    if any(w in lower for w in ("одобр", "гарант", "точно дадут")):
        content = (
            f"Я не могу обещать одобрение — решение принимает банк после полной проверки. "
            f"{DISCLAIMER}\n\n"
            "Могу помочь подготовить заявку: заполнить цель, сравнить продукты и посчитать платёж."
        )
        actions = [
            {"label": "Индекс готовности", "path": "/app/readiness"},
            {"label": "Оформить заявку", "path": "/app/applications"},
        ]
        sources = ["Каталог продуктов Линия решения (демо)"]
    elif detected_goal:
        label = GOAL_LABELS.get(detected_goal, detected_goal)
        suitable = [
            p for p in products if detected_goal in (p.suitable_goals or [])
        ]
        names = ", ".join(p.name for p in suitable[:3]) or "подходящие продукты из каталога"
        content = (
            f"Похоже, цель — «{label}». "
            f"Для неё обычно рассматривают: {names}.\n\n"
            "Уточните, пожалуйста:\n"
            "1) Ориентировочная сумма финансирования?\n"
            "2) Желаемый срок (месяцев)?\n"
            "3) Есть ли собственные средства на часть затрат?\n\n"
            f"После этого перейдём к подбору. {DISCLAIMER}"
        )
        actions = [
            {"label": "Мастер бизнес-цели", "path": "/app/goals"},
            {"label": "Рекомендации", "path": "/app/recommendations"},
        ]
        sources = [f"Каталог: {p.name} (ставка {p.rate_min}–{p.rate_max}% годовых)" for p in suitable[:3]]
    elif matched or "ставк" in lower or "услов" in lower or "продукт" in lower:
        target = matched or products[:2]
        lines = []
        for p in target:
            lines.append(
                f"• **{p.name}** ({p.type.value}): сумма {p.amount_min:,.0f}–{p.amount_max:,.0f} ₽, "
                f"срок {p.term_min}–{p.term_max} мес., ставка {p.rate_min}–{p.rate_max}% годовых "
                f"(из демо-каталога). Залог: {'да' if p.collateral_required else 'не обязателен на предскоринге'}."
            )
            sources.append(f"{p.name}: rate {p.rate_min}–{p.rate_max}%")
        content = (
            "Условия из демо-каталога платформы (не оферта банка):\n\n"
            + "\n".join(lines)
            + f"\n\nСтавки и лимиты требуют подтверждения банком. {DISCLAIMER}"
        )
        actions = [
            {"label": "Сравнить продукты", "path": "/app/compare"},
            {"label": "Калькулятор", "path": "/app/calculator"},
        ]
    elif last_recommendations:
        top = last_recommendations[0]
        content = (
            f"По итогам подбора лидирует «{top.get('product_name')}» "
            f"(score {top.get('match_score')}). "
            f"Ориентировочный платёж ~{top.get('estimated_monthly_payment')} ₽/мес. "
            f"Причины: {'; '.join(top.get('reasons', [])[:2])}.\n\n"
            f"{DISCLAIMER}"
        )
        sources = [f"Rule engine {top.get('product_id', '')}"]
        actions = [
            {"label": "Scenario Lab", "path": "/app/scenarios"},
            {"label": "Подать заявку", "path": "/app/applications"},
        ]
    elif any(w in lower for w in ("платёж", "платеж", "график", "аннуитет")):
        content = (
            "Платежи считает расчётный движок платформы (аннуитет / дифференцированный), "
            "а не я сам. Откройте калькулятор — там можно выгрузить график в CSV.\n\n"
            f"{DISCLAIMER}"
        )
        actions = [{"label": "Калькулятор", "path": "/app/calculator"}]
        sources = ["Finance engine: annuity / differentiated"]
    else:
        who = f" для {company_name}" if company_name else ""
        content = (
            f"Я AI-консультант Линии решения{who}. Могу:\n"
            "• помочь сформулировать бизнес-цель и сумму потребности;\n"
            "• объяснить продукты из каталога (со ссылкой на условия);\n"
            "• направить к подбору, сценариям и заявке.\n\n"
            "Напишите, что планируете профинансировать, или спросите про конкретный продукт.\n\n"
            f"{DISCLAIMER}"
        )
        actions = [
            {"label": "Бизнес-цель", "path": "/app/goals"},
            {"label": "AI-чат", "path": "/app/ai"},
        ]
        sources = ["Линия решения demo catalog"]

    return {
        "id": str(uuid4()),
        "role": "assistant",
        "content": content,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "sources": sources,
        "suggested_actions": actions,
    }
