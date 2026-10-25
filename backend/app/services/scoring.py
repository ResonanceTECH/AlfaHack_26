"""Адаптер экспертной скоркарты. Данные scoring в metrics задаёт доверенный seed.

Контракт credit_scoring сохраняется; ставки переводятся в проценты только для БД.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from credit_scoring import Decision, Product, ScoringInput, score, to_jsonable
from app.core.enums import ApplicationStatus, DecisionType
from app.models.company import Company
from app.models.credit import CreditProduct
from app.models.decision import CreditDecision
from app.models.finance import FinancialSnapshot
from app.services.audit import write_audit


def build_input(app, company, snapshot, product, *, as_of=None):
    """Не подменяет отсутствующие сведения благоприятными значениями."""
    extra = dict((snapshot.metrics or {}).get("scoring", {})) if snapshot else {}
    rules = (product.eligibility_rules or {}) if product else {}
    product_type = getattr(app.product_type, "value", app.product_type)
    scoring_product = Product(rules.get("scoring_product", product_type))
    financials = None
    if snapshot is not None:
        financials = extra.get("financials", {
            "revenue_12m": float(snapshot.avg_monthly_revenue) * 12,
            "expenses_12m": float(snapshot.operating_expenses) * 12,
            # Нет сопоставимого прошлого периода: динамика не применяется.
            "revenue_prev_12m": 0,
        })
    return ScoringInput.from_dict({
        "company": {"inn": company.inn, "name": company.name,
                    "org_type": "ИП" if getattr(company.legal_form, "value", company.legal_form) == "IP" else "ООО"},
        "application": {"product": scoring_product.value, "amount": float(app.amount),
                        "term_months": app.term_months, "purpose": app.purpose or ""},
        "egrul": {"status": company.registry_status.lower(),
                  "registration_date": company.registration_date.isoformat(),
                  "okved_main": extra.get("okved_main", "")} if company.registry_status else None,
        "financials": financials,
        "bki": extra.get("bki"), "fns": extra.get("fns"),
        "as_of": (as_of or date.today()).isoformat(),
    })


def process_scoring(db, app, *, workflow=None):
    # Локальные импорты исключают цикл workflow -> scoring -> decisions -> workflow.
    from app.services.decisions import issue_decision
    from app.services.workflow import transition_application

    company = db.get(Company, app.company_id)
    product = db.get(CreditProduct, app.product_id)
    snapshot = db.scalar(select(FinancialSnapshot).where(
        FinancialSnapshot.company_id == app.company_id
    ).order_by(FinancialSnapshot.updated_at.desc(), FinancialSnapshot.id.desc()).limit(1))
    try:
        if company is None:
            raise ValueError("company_not_found")
        inp = build_input(app, company, snapshot, product)
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        # Несовместимый каталог/неполные сведения не приводят к автоотказу.
        payload = {"decision": "manual_review", "reasons": ["scoring_input_invalid"],
                   "error_type": type(exc).__name__}
        if workflow is not None:
            workflow.context = {**(workflow.context or {}), "scoring": payload}
        transition_application(db, app, ApplicationStatus.IN_REVIEW, actor=None,
                               comment="Нужна проверка входных данных скоринга", bump_version=False)
        write_audit(db, actor_id=None, entity_type="application", entity_id=app.id,
                    company_id=app.company_id, action="scoring.input_invalid", details=payload)
        return payload

    result = score(inp)
    payload = to_jsonable(result)
    target = {
        Decision.APPROVED: ApplicationStatus.APPROVED,
        Decision.COUNTER_OFFER: ApplicationStatus.COUNTEROFFERED,
        Decision.REJECTED: ApplicationStatus.REJECTED,
        Decision.REQUEST_DATA: ApplicationStatus.DOCS_REQUESTED,
        Decision.MANUAL_REVIEW: ApplicationStatus.IN_REVIEW,
    }[result.decision]
    dtype = {Decision.APPROVED: DecisionType.APPROVED,
             Decision.COUNTER_OFFER: DecisionType.COUNTEROFFERED,
             Decision.REJECTED: DecisionType.REJECTED}.get(result.decision)
    explanation = {
        Decision.APPROVED: "Предварительное одобрение по экспертной скоркарте",
        Decision.COUNTER_OFFER: "Предложены условия в пределах кредитной политики",
        Decision.REJECTED: "Отказ по экспертной скоркарте",
        Decision.REQUEST_DATA: "Необходимо дополнить данные заявки",
        Decision.MANUAL_REVIEW: "Заявка передана кредитному аналитику",
    }[result.decision]
    transition_application(db, app, target, actor=None, comment=explanation, bump_version=False)
    if dtype is not None:
        offer = result.offer
        decision = issue_decision(
            db, app=app, decision_type=dtype, actor=None,
            reason_codes=result.reasons, explanation=explanation,
            offer_amount=Decimal(str(offer.amount)) if offer else None,
            offer_term_months=offer.term_months if offer else None,
            offer_rate=Decimal(str(offer.annual_rate)) * 100 if offer else None,
        )
    else:
        # NEED_INFO — совместимая запись БД; исходная семантика остаётся в payload.
        decision = CreditDecision(application_id=app.id, decision_type=DecisionType.NEED_INFO,
                                  reason_codes=result.reasons, explanation=explanation)
        db.add(decision)
    decision.score = result.score
    decision.factors = {f.id: to_jsonable(f) for f in result.factors}
    decision.model_version = result.config_version
    decision.policy_version_id = None
    decision.payload = {"decision_scope": "DEMO_PRELIMINARY", "policy_version": result.config_version,
                        "scoring": payload, "scoring_input": to_jsonable(inp)}
    if workflow is not None:
        workflow.context = {**(workflow.context or {}), "scoring": payload}
    db.flush()
    write_audit(db, actor_id=None, entity_type="application", entity_id=app.id,
                company_id=app.company_id, action="scoring.completed",
                details={"decision_id": decision.id, "result": payload})
    db.flush()
    return payload
