"""Детерминированные инструменты подготовки фактов и preview, без вызовов LLM."""
from dataclasses import replace
import math
import json
import re

from credit_scoring import ScoringInput, load_config, score
from .models import Fact

DECISIONS = {
    "approved": "Предварительно одобрено на запрошенных условиях.",
    "counter_offer": "Предложены другие условия финансирования.",
    "rejected": "По заявке получен отказ.",
    "manual_review": "Заявка требует рассмотрения аналитиком.",
    "request_data": "Для рассмотрения необходимо дополнить данные.",
}
ACTIONS = {
    "review_offer": "Ознакомьтесь с предложенными условиями в карточке заявки.",
    "wait_review": "Ожидайте рассмотрения заявки аналитиком внутри платформы.",
    "provide_data": "Дополните данные и документы в карточке заявки.",
    "adjust_request": "Проверьте предварительный расчёт с другими параметрами заявки.",
    "choose_product": "Выберите продукт и подтвердите параметры перед подачей заявки.",
    "clarify_goal": "Уточните цель финансирования.",
    "clarify_amount": "Уточните необходимую сумму финансирования.",
    "clarify_term": "Уточните желаемый срок в месяцах.",
}

TOPICS = ("кредит", "заяв", "скор", "просроч", "выруч", "марж", "доход", "расход", "статус",
          "сумм", "срок", "услов", "ставк", "плат", "отказ", "одобр", "предлож", "продукт",
          "долг", "бизнес", "налог", "фактор", "объясн", "провер", "документ", "данн",
          "оборуд", "станок", "магазин", "кассов", "разрыв", "закуп", "товар", "финанс")


def number(value):
    return f"{value:.4f}".rstrip("0").rstrip(".")


def restrict_unknown_question(context):
    question = context["question"].lower().strip()
    if (question and not any(word in question for word in TOPICS)
            and not re.search(r"\d\s*(?:млн|миллион|тыс|руб|₽|мес)", question)):
        context.update(canonical_summary="В доступных данных нет ответа на этот вопрос.",
                       facts=[], actions={}, eligible_product_ids=[], answerable=False)
    return context


def scoring_context(result, *, analyst=False, status=None, question="", simulations=()):
    facts = []
    for scope, factors in (("request", result.get("factors", [])),
                           ("offer", result.get("offer_factors", []))):
        for factor in factors:
            direction = "поддерживает оценку" if factor["points"] > 0 else (
                "снижает оценку" if factor["points"] < 0 else "нейтрален в оценке")
            text = f"{factor['label']}: {direction}."
            if not factor["applied"]:
                text = f"{factor['label']}: фактор не применён."
            if analyst:
                text += f" Значение: {factor['value']}; вклад: {factor['points']} баллов."
                if factor.get("raw_points") is not None:
                    text += f" До группового ограничения: {factor['raw_points']}."
            facts.append(Fact(id=f"{scope}:factor:{factor['id']}", text=text,
                              kind="factor", scope=scope, factor_id=factor["id"]))
    for rule in result.get("rule_hits", []):
        # Клиент не получает численные пороги правил даже в описаниях.
        text = rule["description"] if analyst else {
            "egrul_not_active": "Статус компании не соответствует условиям рассмотрения.",
            "min_company_age": "Недостаточный срок работы бизнеса.",
            "product_min_age": "Срок работы бизнеса недостаточен для выбранного продукта.",
            "overdue_now": "Есть текущая просрочка по кредитным обязательствам.",
            "tax_debt": "Налоговая задолженность требует проверки аналитиком.",
            "unreliable_info": "Сведения о компании требуют уточнения.",
            "bki_unavailable": "Нет сведений о кредитной истории.",
            "fns_unavailable": "Нет сведений о налоговом статусе.",
        }.get(rule["id"], "Требуется проверка соответствия кредитной политике.")
        facts.append(Fact(id=f"request:rule:{rule['id']}", text=text, kind="rule", rule_id=rule["id"]))
    for missing in result.get("missing_data", []):
        label = {"financials": "финансовые сведения", "egrul": "сведения о регистрации"}.get(missing, "сведения")
        facts.append(Fact(id=f"request:missing:{missing}", text=f"Необходимо дополнить {label}.", kind="status"))
    reason_texts = {
        "amount_reduced_to_limit": "Сумма предложения уменьшена до допустимого лимита кредитной политики.",
        "term_reduced_to_limit": "Срок предложения уменьшен до допустимого срока кредитной политики.",
        "term_raised_to_product_minimum": "Срок предложения увеличен до минимального срока продукта.",
        "limit_below_product_minimum": "Допустимая сумма ниже минимальной суммы выбранного продукта.",
        "band_requires_manual_review": "Текущая оценка по этому продукту требует решения аналитика.",
    }
    for index, reason in enumerate(result.get("reasons", [])):
        text = reason_texts.get(reason)
        if reason.startswith("risk_band_not_served:"):
            text = "По текущей оценке выбранный продукт недоступен."
        if text:
            facts.append(Fact(id=f"request:reason:{index}", text=text, kind="status"))
    offer = result.get("offer")
    if offer:
        prefix = "Предварительные условия для рассмотрения аналитиком" if result["decision"] == "manual_review" else "Условия предложения"
        text = (f"{prefix}: сумма {number(offer['amount'])} ₽, срок {offer['term_months']} мес., "
                f"ставка {number(offer['annual_rate'] * 100)}% годовых, "
                f"аннуитетный платёж {number(offer['monthly_payment'])} ₽.")
        facts.append(Fact(id="offer:terms", text=text, kind="offer", scope="offer"))
    if analyst:
        facts.append(Fact(id="request:score", kind="status",
                          text=f"Исходный скор {result.get('score')}, уровень {result.get('risk_band')}."))
        if offer:
            facts.append(Fact(id="offer:score", kind="status", scope="offer",
                              text=f"Скор оффера {result.get('offer_score')}, уровень {result.get('offer_risk_band')}."))
    if status:
        facts.append(Fact(id="request:status", kind="status", text=f"Текущий статус заявки: {status}."))
    facts.extend(simulations)
    decision = result["decision"]
    actions = {key: ACTIONS[key] for key in {
        "approved": ["review_offer"], "counter_offer": ["review_offer", "adjust_request"],
        "rejected": ["adjust_request"], "manual_review": ["wait_review"],
        "request_data": ["provide_data"],
    }[decision]}
    complete = result.get("score_complete", False)
    canonical = DECISIONS[decision]
    if not complete:
        canonical += " Данные неполные; оценка не сопоставима с оценками по полным данным."
    return restrict_unknown_question({"mode": "analyst_summary" if analyst else "explanation", "question": question,
            "role": "analyst" if analyst else "client", "canonical_summary": canonical,
            "decision": decision, "score_complete": complete,
            "facts": [f.model_dump() for f in facts], "actions": actions,
            "eligible_product_ids": [], "prefill": {}})


def get_preview(inp: ScoringInput, cfg, *, amount=None, term_months=None):
    """Тот же score: ничего не записывает и не обещает одобрения."""
    candidate = replace(inp, application=replace(inp.application,
        amount=amount if amount is not None else inp.application.amount,
        term_months=term_months if term_months is not None else inp.application.term_months))
    return score(candidate, cfg)


def verified_changes(inp: ScoringInput, result, *, cfg=None):
    cfg = cfg or load_config()
    # Пересчёт старого решения текущей политикой нельзя выдавать за объяснение старого.
    if result.get("config_version") != cfg["version"]:
        return []
    if result.get("decision") == "approved":
        return []
    candidates = [(inp.application.amount * .75, inp.application.term_months),
                  (inp.application.amount * .5, inp.application.term_months)]
    if result.get("offer"):
        offer = result["offer"]
        candidates.insert(0, (offer["amount"], offer["term_months"]))
    facts, seen = [], set()
    for amount, term in candidates:
        if (amount, term) in seen or (amount, term) == (inp.application.amount, inp.application.term_months):
            continue
        seen.add((amount, term))
        preview = get_preview(inp, cfg, amount=amount, term_months=term)
        if preview.decision.value in ("approved", "counter_offer"):
            text = (f"При сумме запроса {number(amount)} ₽ и сроке {term} мес. предварительный расчёт: "
                    f"{DECISIONS[preview.decision.value]} Это отдельный расчёт, а не изменение текущего решения.")
            facts.append(Fact(id=f"simulation:{len(facts)}", text=text, kind="simulation"))
    return facts[:3]


GOALS = {"inventory_purchase": ("закуп", "товар"), "equipment": ("станок", "оборудован"),
         "cash_gap": ("кассов", "разрыв"), "new_point": ("точк", "магазин"),
         "production_expansion": ("расшир", "производств")}


def catalog_context(products, *, question="", goal=None, amount=None, term_months=None, prior_prefill=None):
    lower = question.lower()
    goal = goal or next((key for key, words in GOALS.items() if any(w in lower for w in words)), None)
    if amount is None:
        match = re.search(r"(?<![\d.,−-])(\d+(?:[.,]\d+)?)\s*(млн|миллион|тыс|тысяч|руб|₽)", lower)
        if match:
            multiplier = 1_000_000 if match[2].startswith(("млн", "миллион")) else (
                1000 if match[2].startswith(("тыс", "тысяч")) else 1)
            amount = float(match[1].replace(",", ".")) * multiplier
            if not math.isfinite(amount) or amount <= 0:
                amount = None
    if term_months is None:
        match = re.search(r"(?<![\d−-])(\d+)\s*(?:мес|месяц)", lower)
        term_months = int(match[1]) if match else None
        if term_months is not None and not 1 <= term_months <= 360:
            term_months = None
    prior = prior_prefill or {}
    goal = goal or prior.get("goal_type")
    amount = amount if amount is not None else prior.get("amount")
    term_months = term_months if term_months is not None else prior.get("term_months")
    prefill = {k: v for k, v in {"goal_type": goal, "amount": amount, "term_months": term_months}.items() if v is not None}
    facts, eligible = [], []
    for p in products[:50]:
        if not p.get("is_active", True) or p.get("status") != "PUBLISHED":
            continue
        fits = ((goal is None or goal in p["suitable_goals"])
                and (amount is None or p["amount_min"] <= amount <= p["amount_max"])
                and (term_months is None or p["term_min"] <= term_months <= p["term_max"]))
        if fits:
            eligible.append(p["id"])
            facts.append(Fact(id=f"catalog:product:{p['id']}", kind="product", scope="catalog", product_id=p["id"],
                text=f"{p['name']}: сумма {number(p['amount_min'])}–{number(p['amount_max'])} ₽; "
                     f"срок {p['term_min']}–{p['term_max']} мес.; ставка каталога {number(p['rate_min'])}–{number(p['rate_max'])}% годовых. "
                     f"Залог: {'требуется' if p.get('collateral_required') else 'не обязателен по каталогу'}. "
                     f"Документы: {', '.join(p.get('documents', [])) or 'уточняются в карточке продукта'}. "
                     f"Комиссии: {json.dumps(p.get('fees', []), ensure_ascii=False)}. "
                     "Персональные условия определяются после скоринга."))
            if len(eligible) >= 12:
                break
    actions = {key: ACTIONS[key] for key, value in (("clarify_goal", goal), ("clarify_amount", amount),
                                                     ("clarify_term", term_months)) if value is None}
    if eligible:
        actions["choose_product"] = ACTIONS["choose_product"]
    summary = "Предварительный подбор по опубликованному каталогу." if eligible else "По указанным параметрам подходящих продуктов в каталоге нет."
    return restrict_unknown_question({"mode": "product_selection", "role": "client", "question": question,
            "canonical_summary": summary, "score_complete": None,
            "facts": [f.model_dump() for f in facts], "actions": actions,
            "eligible_product_ids": eligible, "prefill": prefill})
