"""Граница авторизации и аудита агента. Публичный запрос не принимает scoring JSON."""
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from credit_scoring import ScoringInput
from app.core.enums import ProductStatus, UserRole
from app.models.application import CreditApplication
from app.models.credit import CreditProduct
from app.models.decision import CreditDecision
from app.services.access import require_application_access, require_company_access
from app.services.audit import write_audit
from app.services.credit_agent import AgentConfig, catalog_context, scoring_context, verified_changes, run_agent


def agent_config():
    from app.config import get_settings
    cfg = get_settings()
    return AgentConfig(enabled=cfg.llm_enabled, base_url=cfg.llm_base_url,
                       llm_main=cfg.llm_main, llm_light=cfg.llm_light,
                       timeout_seconds=cfg.llm_timeout_seconds, max_tokens=cfg.llm_max_tokens,
                       api_key=cfg.llm_api_key)


def agent_status():
    cfg = agent_config()
    return {"ready": True, "mode": "LLM_CONFIGURED" if cfg.enabled else "RULES_FALLBACK",
            "model_active": cfg.llm_main if cfg.enabled else None,
            "disclaimer": "Локальная LLM настроена; доступность проверяется при запросе, предусмотрен шаблонный резерв."
                          if cfg.enabled else "Модель отключена; доступны шаблонные разъяснения."}


def catalog_products(db):
    products = db.scalars(select(CreditProduct).where(
        CreditProduct.is_active.is_(True), CreditProduct.status == ProductStatus.PUBLISHED
    ).order_by(CreditProduct.id).limit(50)).all()
    return [{"id": p.id, "name": p.name, "is_active": p.is_active,
             "status": p.status.value, "suitable_goals": p.suitable_goals or [],
             "amount_min": float(p.amount_min), "amount_max": float(p.amount_max),
             "term_min": p.term_min, "term_max": p.term_max,
             "rate_min": float(p.rate_min), "rate_max": float(p.rate_max),
             "collateral_required": p.collateral_required, "documents": p.documents or [],
             "fees": p.fees or []} for p in products]


def _execute(db, user, company_id, entity_id, context):
    run = run_agent(context, agent_config())
    event = write_audit(db, actor_id=user.id, entity_type="credit_agent", entity_id=entity_id,
                       company_id=company_id, action="credit_agent.response", details=run.audit)
    db.flush()
    return {"response_id": event.id, **run.response.model_dump()}


def explain_application(db, user, application_id, *, question="", company_id=None):
    app = db.get(CreditApplication, application_id)
    if app is None:
        raise HTTPException(404, "Заявка не найдена")
    require_application_access(db, user, app)
    if company_id is not None and app.company_id != company_id:
        raise HTTPException(404, "Заявка не найдена")
    decision = db.scalar(select(CreditDecision).where(CreditDecision.application_id == app.id)
                         .order_by(CreditDecision.created_at.desc(), CreditDecision.id.desc()).limit(1))
    saved = (decision.payload or {}) if decision else {}
    result = saved.get("scoring")
    if not result:
        # Не объясняем новое ручное решение устаревшим автоматическим скором.
        context = {"mode": "question", "role": "client", "question": question,
                   "canonical_summary": "Для текущего решения структурированный результат скоринга отсутствует.",
                   "score_complete": None, "facts": [], "actions": {},
                   "eligible_product_ids": [], "prefill": {}}
    else:
        changes = []
        if saved.get("scoring_input"):
            try:
                changes = verified_changes(ScoringInput.from_dict(saved["scoring_input"]), result)
            except (ValueError, TypeError, KeyError):
                # Старый/неполный вход не используется для новых обещаний.
                pass
        context = scoring_context(result, analyst=user.role == UserRole.ANALYST,
                                  status=app.status.value, question=question, simulations=changes)
    return _execute(db, user, app.company_id, app.id, context)


def select_product(db, user, company_id, *, question="", goal=None, amount=None, term_months=None, prior_prefill=None):
    require_company_access(db, user, company_id)
    context = catalog_context(catalog_products(db), question=question, goal=goal,
                              amount=amount, term_months=term_months, prior_prefill=prior_prefill)
    return _execute(db, user, company_id, company_id, context)


def conversation_reply(db, user, company_id, *, question, application_id=None, prior_prefill=None):
    data = (explain_application(db, user, application_id, question=question, company_id=company_id)
            if application_id else select_product(db, user, company_id, question=question, prior_prefill=prior_prefill))
    from app.services.credit_agent.models import AgentResponse
    response = AgentResponse.model_validate({k: v for k, v in data.items() if k != "response_id"})
    return {"id": str(uuid4()), "content": response.as_text(), "agent": data,
            "sources": list(dict.fromkeys(r.source_id for r in response.main_reasons)),
            "suggested_actions": [{"label": "Открыть заявку", "path": f"/app/applications/{application_id}"}]
                                 if application_id else [{"label": "Подбор продуктов", "path": "/app/recommendations"}]}
