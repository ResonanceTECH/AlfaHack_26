"""Проверка настоящего ядра и ORM-объектов без внешних сервисов.

Session заменена хранилищем в памяти; SQL/транзакции PostgreSQL здесь не проверяются.
"""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from credit_scoring import score, to_jsonable
from credit_scoring.generator import personas
from app.core.enums import ApplicationStatus, LegalForm, ProductType
from app.models.application import CreditApplication, ApplicationWorkflow
from app.models.audit import AuditEvent
from app.models.company import Company
from app.models.credit import CreditProduct
from app.models.decision import CreditDecision, CreditOffer
from app.models.finance import FinancialSnapshot
from app.services.scoring import build_input, process_scoring
from app.services.workflow import run_automated_validation


class MemorySession:
    def __init__(self, company, snapshot, product):
        self.company, self.snapshot, self.product = company, snapshot, product
        self.added = []

    def get(self, model, key):
        return {Company: self.company, CreditProduct: self.product}.get(model)

    def scalar(self, query):
        # В адаптере выбирается последний снимок; issue_decision читает policy.
        entity = query.column_descriptions[0].get("entity")
        return self.snapshot if entity is FinancialSnapshot else None

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = str(uuid4())
            if hasattr(obj, "created_at") and obj.created_at is None:
                obj.created_at = datetime.now(timezone.utc)


def setup_case(persona_id):
    inp = next(p.input for p in personas() if p.id == persona_id)
    company = Company(id="company", inn=inp.company.inn, name=inp.company.name,
                      legal_form=LegalForm.OOO, registry_status=inp.egrul.status.upper(),
                      registration_date=inp.egrul.registration_date)
    snapshot = FinancialSnapshot(id="snap", company_id=company.id, avg_monthly_revenue=Decimal("2000000"),
                                 operating_expenses=Decimal("1640000"),
                                 metrics={"scoring": {"financials": to_jsonable(inp.financials),
                                                     "okved_main": inp.egrul.okved_main,
                                                     "bki": to_jsonable(inp.bki), "fns": to_jsonable(inp.fns)}})
    product = CreditProduct(id="product", eligibility_rules={"scoring_product": inp.application.product.value})
    app = CreditApplication(id="app", company_id=company.id, product_id=product.id,
                            product_type=ProductType.WORKING_CAPITAL, amount=Decimal(str(inp.application.amount)),
                            term_months=inp.application.term_months, purpose="", readiness_score=99,
                            status=ApplicationStatus.VALIDATING, version=1, workflows=[], offers=[],
                            decisions=[], status_history=[], checks=[], documents=[])
    return inp, app, company, snapshot, product, MemorySession(company, snapshot, product)


@pytest.mark.parametrize("persona_id", [p.id for p in personas()])
def test_all_personas_keep_core_contract(persona_id, monkeypatch):
    inp, app, company, snapshot, product, db = setup_case(persona_id)
    original = build_input
    monkeypatch.setattr("app.services.scoring.build_input",
                        lambda *args: original(*args, as_of=inp.as_of))
    actual = process_scoring(db, app)
    assert actual == to_jsonable(score(inp))
    expected_status = {"approved": "APPROVED", "counter_offer": "COUNTEROFFERED",
                       "manual_review": "IN_REVIEW", "rejected": "REJECTED",
                       "request_data": "DOCS_REQUESTED"}[actual["decision"]]
    assert app.status.value == expected_status
    decision = next(obj for obj in db.added if isinstance(obj, CreditDecision))
    assert decision.score == actual["score"]
    assert decision.score != app.readiness_score
    assert decision.payload["scoring_input"]["as_of"] == inp.as_of.isoformat()
    assert decision.payload["scoring"] == actual
    audit = next(obj for obj in db.added if isinstance(obj, AuditEvent))
    assert audit.details["decision_id"] == decision.id
    assert audit.details["result"] == actual
    offers = [obj for obj in db.added if isinstance(obj, CreditOffer)]
    if actual["decision"] in ("approved", "counter_offer"):
        assert len(offers) == 1
        assert offers[0].rate == Decimal(str(actual["offer"]["annual_rate"])) * 100
        assert float(offers[0].amount) == actual["offer"]["amount"]
        assert float(offers[0].monthly_payment) == actual["offer"]["monthly_payment"]
    else:
        assert not offers


def test_workflow_calls_scoring_and_stops_repeated_validation():
    _, app, _, _, _, db = setup_case("ideal")
    app.status = ApplicationStatus.SUBMITTED
    run_automated_validation(db, app, actor=None)
    assert app.status in (ApplicationStatus.APPROVED, ApplicationStatus.COUNTEROFFERED)
    before = len(db.added)
    run_automated_validation(db, app, actor=None)
    assert len(db.added) == before


def test_unknown_catalog_product_goes_to_analyst():
    _, app, _, _, product, db = setup_case("ideal")
    product.eligibility_rules = {}
    app.product_type = ProductType.INVESTMENT
    wf = ApplicationWorkflow(context={})
    result = process_scoring(db, app, workflow=wf)
    assert app.status == ApplicationStatus.IN_REVIEW
    assert result["reasons"] == ["scoring_input_invalid"]
    assert wf.context["scoring"] == result
    assert not any(isinstance(obj, CreditOffer) for obj in db.added)


def test_missing_reports_are_not_invented():
    _, app, company, snapshot, product, _ = setup_case("ideal")
    snapshot.metrics = {}
    inp = build_input(app, company, snapshot, product)
    assert inp.bki is None and inp.fns is None
    assert inp.financials.revenue_prev_12m == 0
    assert score(inp).decision.value == "manual_review"


def test_missing_snapshot_requests_data():
    _, app, _, _, _, db = setup_case("ideal")
    db.snapshot = None
    result = process_scoring(db, app)
    assert result["decision"] == "request_data"
    assert result["missing_data"] == ["financials"]
    assert app.status == ApplicationStatus.DOCS_REQUESTED


def test_seed_only_adds_missing_synthetic_block():
    from scripts.seed_scoring import seed_scoring

    _, _, _, snapshot, _, db = setup_case("ideal")
    snapshot.company_id = "company_001"
    snapshot.metrics = {"other_metric": 7}
    db.scalars = lambda query: [snapshot] if query.compile().params["company_id_1"] == "company_001" else []
    seed_scoring(db)
    assert snapshot.metrics["other_metric"] == 7
    assert snapshot.metrics["scoring"]["persona_id"] == "ideal"
    assert snapshot.metrics["scoring"]["financials"]["revenue_12m"] == float(snapshot.avg_monthly_revenue) * 12
    snapshot.metrics["scoring"]["bki"]["monthly_payments"] = 123
    seed_scoring(db)
    assert snapshot.metrics["scoring"]["bki"]["monthly_payments"] == 123
