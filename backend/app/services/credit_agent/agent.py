"""Оркестрация: проверенные факты → LLM → проверки → шаблон при любой ошибке."""
from dataclasses import dataclass
import re

import httpx

from .client import AgentConfig, LocalLLM
from .models import AgentResponse, GeneratedAnswer, GroundedReason, PROMPT_VERSION


def _numbers(text):
    return set(re.findall(r"\d+(?:[.,]\d+)?", text.replace(",", ".")))


def validate_answer(answer, context):
    facts = {f["id"]: f for f in context["facts"]}
    errors = []
    if _numbers(answer.summary):
        errors.append("numbers_in_summary")
    texts = [answer.summary]
    for section in ("main_reasons", "what_to_change"):
        for cited in getattr(answer, section):
            fact = facts.get(cited.source_id)
            if fact is None:
                errors.append("unknown_source")
                continue
            if section == "what_to_change" and fact["kind"] != "simulation":
                errors.append("unverified_change")
            if section == "main_reasons" and fact["kind"] == "simulation":
                errors.append("simulation_as_current_decision")
            if not _numbers(cited.text) <= _numbers(fact["text"]):
                errors.append("ungrounded_number")
            texts.append(cited.text)
    cited_ids = {r.source_id for r in answer.main_reasons}
    mandatory = {f["id"] for f in context["facts"] if f["kind"] == "rule" or ":missing:" in f["id"] or ":reason:" in f["id"]}
    if not mandatory <= cited_ids:
        errors.append("missing_critical_reasons")
    if not set(answer.next_steps) <= context["actions"].keys():
        errors.append("unknown_action")
    if not set(answer.product_ids) <= set(context["eligible_product_ids"]):
        errors.append("unknown_product")
    if len(set(answer.product_ids)) != len(answer.product_ids):
        errors.append("duplicate_product")
    for product_id in answer.product_ids:
        if f"catalog:product:{product_id}" not in cited_ids:
            errors.append("product_without_source")
    text = " ".join(texts).lower()
    if re.search(r"гарантир|точно\s+(?:одобр|выда|получ)|обязательн\w*\s+одобр|100\s*%|безусловн\w*\s+одобр", text):
        errors.append("approval_promise")
    if re.search(r"https?://|www\.|\bemail\b|\bsms\b|смс|позвон|отправ\w*\s+письм", text):
        errors.append("external_channel")
    if "<think" in text or "</think" in text:
        errors.append("thinking_output")
    if context["role"] == "client" and re.search(r"порог|корзин|балл|уровень\s+[abcdа-с]|\bscore\b", text):
        errors.append("internal_policy_disclosure")
    # Результат объявляет только детерминированный заголовок; вольный текст не вправе его менять.
    if re.search(r"(?:вам|заявк\w*|кредит\w*)\s+(?:одобрен|отклон[её]н)|решение\s*[—:-]?\s*(?:одобр|отказ)", text):
        errors.append("decision_restatement")
    return sorted(set(errors))


def template_answer(context):
    facts = context["facts"]
    selected = sorted((f for f in facts if f["kind"] != "simulation"),
                      key=lambda f: (0 if f["kind"] == "rule" or ":missing:" in f["id"] or ":reason:" in f["id"] else
                                     1 if f["kind"] in ("offer", "status", "product") else
                                     2 if "снижает" in f["text"] else 3))[:8]
    # Обязательные правила сохраняются даже при большом наборе факторов.
    return GeneratedAnswer(summary="Разбор основан на доступных сведениях.",
        main_reasons=[{"source_id": f["id"], "text": f["text"]} for f in selected],
        what_to_change=[{"source_id": f["id"], "text": f["text"]}
                        for f in facts if f["kind"] == "simulation"][:3],
        next_steps=list(context["actions"])[:5], product_ids=context["eligible_product_ids"][:3])


@dataclass
class AgentRun:
    response: AgentResponse
    audit: dict


def run_agent(context, config=None, *, llm=None):
    config = config or AgentConfig()
    model = config.llm_light if context["mode"] == "product_selection" else config.llm_main
    errors, raw, answer, used_llm = [], None, None, False
    if config.enabled and context.get("answerable", True):
        llm = llm or LocalLLM(config)
        for attempt in range(2):
            try:
                raw = llm.generate(context, light=context["mode"] == "product_selection")
                answer = GeneratedAnswer.model_validate_json(raw)
                errors = validate_answer(answer, context)
                if errors:
                    answer = None
                else:
                    used_llm = True
                break
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                errors = [type(exc).__name__]
                if attempt == 1:
                    break
            except (ValueError, TypeError, KeyError, IndexError, AttributeError, httpx.HTTPError) as exc:
                errors = [type(exc).__name__]
                break
    if answer is None:
        answer = template_answer(context)
    facts = {f["id"]: f for f in context["facts"]}
    def grounded(cited):
        fact = facts[cited.source_id]
        return GroundedReason(**cited.model_dump(), scope=fact["scope"],
                              factor_id=fact["factor_id"], rule_id=fact["rule_id"], product_id=fact["product_id"])
    response = AgentResponse(
        summary=context["canonical_summary"] + " " + answer.summary,
        main_reasons=[grounded(r) for r in answer.main_reasons],
        what_to_change=[grounded(r) for r in answer.what_to_change],
        next_steps=[context["actions"][key] for key in answer.next_steps],
        product_ids=answer.product_ids,
        prefill={**context["prefill"], **({"product_id": answer.product_ids[0]} if answer.product_ids else {})},
        mode="llm" if used_llm else "template", model=model if config.enabled else None,
        validation_errors=errors, score_complete=context["score_complete"])
    return AgentRun(response=response, audit={"prompt_version": PROMPT_VERSION,
        "model": response.model, "mode": response.mode, "input": context,
        "raw_response": raw[:20000] if isinstance(raw, str) else None,
        "validation_errors": errors, "output": response.model_dump()})
