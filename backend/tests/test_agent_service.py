from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from credit_scoring import score, to_jsonable
from credit_scoring.generator import personas
from app.core.enums import ApplicationStatus, UserRole
from app.models.application import CreditApplication
from app.models.company import CompanyMember
from app.models.decision import CreditDecision
from app.models.audit import AuditEvent
from app.services import agent_service
from app.services.credit_agent import AgentConfig


class ServiceDB:
    def __init__(self, *, member=True, with_scoring=True, draft=False):
        inp = personas()[0].input
        self.application = SimpleNamespace(id="app", company_id="company",
            status=ApplicationStatus.DRAFT if draft else ApplicationStatus.APPROVED)
        self.decision = SimpleNamespace(payload={"scoring": to_jsonable(score(inp)),
                                                 "scoring_input": to_jsonable(inp)} if with_scoring else {})
        self.member, self.added = member, []

    def get(self, model, key):
        if model is CreditApplication and key == "app":
            return self.application
        if model is AuditEvent:
            return next((item for item in self.added if item.id == key), None)

    def scalar(self, query):
        entity = query.column_descriptions[0]["entity"]
        if entity is CompanyMember:
            return SimpleNamespace(role=SimpleNamespace(value="OWNER")) if self.member else None
        if entity is CreditDecision:
            return self.decision

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if obj.id is None:
                obj.id = str(uuid4())

    def commit(self):
        self.flush()


@pytest.fixture(autouse=True)
def disable_model(monkeypatch):
    monkeypatch.setattr(agent_service, "agent_config", lambda: AgentConfig())


def test_owner_receives_client_explanation_and_audit():
    db = ServiceDB()
    user = SimpleNamespace(id="owner", role=UserRole.ENTREPRENEUR)
    result = agent_service.explain_application(db, user, "app")
    assert result["mode"] == "template" and result["response_id"]
    event = db.added[0]
    assert event.action == "credit_agent.response"
    assert event.actor_id == "owner" and event.company_id == "company"
    assert event.details["input"]["role"] == "client"
    assert all("баллов" not in f["text"] for f in event.details["input"]["facts"])


def test_status_reports_configuration_without_claiming_live_inference(monkeypatch):
    assert agent_service.agent_status()["mode"] == "RULES_FALLBACK"
    monkeypatch.setattr(agent_service, "agent_config", lambda: AgentConfig(enabled=True))
    assert agent_service.agent_status()["mode"] == "LLM_CONFIGURED"


def test_analyst_receives_full_summary():
    db = ServiceDB(member=False)
    result = agent_service.explain_application(db, SimpleNamespace(id="bank", role=UserRole.ANALYST), "app")
    assert result["mode"] == "template"
    assert db.added[0].details["input"]["role"] == "analyst"
    assert any("баллов" in f["text"] for f in db.added[0].details["input"]["facts"])


@pytest.mark.parametrize("role,draft,member,company_id", [
    (UserRole.ENTREPRENEUR, False, False, None),
    (UserRole.ANALYST, True, False, None),
    (UserRole.ADMIN, False, True, None),
    (UserRole.ENTREPRENEUR, False, True, "another-company"),
])
def test_access_is_checked_before_any_llm_or_audit(role, draft, member, company_id, monkeypatch):
    db = ServiceDB(member=member, draft=draft)
    def forbidden(*args):
        raise AssertionError("LLM must not be called")
    monkeypatch.setattr(agent_service, "run_agent", forbidden)
    with pytest.raises(HTTPException) as exc:
        agent_service.explain_application(db, SimpleNamespace(id="user", role=role), "app", company_id=company_id)
    assert exc.value.status_code in (403, 404)
    assert not db.added


def test_current_manual_decision_does_not_reuse_old_scoring():
    db = ServiceDB(with_scoring=False)
    result = agent_service.explain_application(db, SimpleNamespace(id="owner", role=UserRole.ENTREPRENEUR), "app")
    assert "отсутствует" in result["summary"]
    assert result["what_to_change"] == []


def test_conversation_keeps_existing_text_contract(monkeypatch):
    db = ServiceDB()
    reply = agent_service.conversation_reply(db, SimpleNamespace(id="owner", role=UserRole.ENTREPRENEUR),
        "company", question="Почему такие условия?", application_id="app")
    assert isinstance(reply["content"], str)
    assert reply["sources"] and reply["agent"]["response_id"]
    assert reply["suggested_actions"][0]["path"] == "/app/applications/app"


@pytest.fixture
def api_client(monkeypatch):
    # Импорт HTTP-роутера без подключения к инфраструктуре; Session переопределена.
    monkeypatch.setenv("DATABASE_URL", "sqlite:///unused-agent-tests.db")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-agent-only-secret")
    from app.config import get_settings
    get_settings.cache_clear()
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.deps import get_current_user
    from app.db.session import get_db
    from app.api.v1.credit_agent import router
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    db = ServiceDB()
    user = SimpleNamespace(id="owner", role=UserRole.ENTREPRENEUR)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as client:
        yield client, db, user
    get_settings.cache_clear()


def test_http_explanation_chat_and_feedback(api_client):
    client, db, _ = api_client
    response = client.post("/api/v1/applications/app/ai/explanation", json={})
    assert response.status_code == 200, response.text
    assert response.json()["mode"] == "template"
    response_id = response.json()["response_id"]
    feedback = client.post(f"/api/v1/ai/responses/{response_id}/feedback", json={"helpful": True})
    assert feedback.status_code == 200
    assert db.added[-1].action == "credit_agent.feedback"
    assert client.post("/api/v1/applications/app/ai/chat", json={"question": "Почему такие условия?"}).status_code == 200
    assert "/api/v1/applications/{application_id}/ai/explanation" in client.get("/openapi.json").json()["paths"]


def test_http_cannot_select_analyst_role_or_read_foreign_data(api_client):
    client, db, user = api_client
    assert client.post("/api/v1/applications/app/ai/explanation", json={"role": "analyst"}).status_code == 422
    db.member = False
    assert client.post("/api/v1/applications/app/ai/explanation", json={}).status_code == 404


def test_http_product_selection_and_invalid_amount(api_client, monkeypatch):
    from tests.test_credit_agent import PRODUCTS
    client, _, _ = api_client
    monkeypatch.setattr(agent_service, "catalog_products", lambda db: PRODUCTS)
    response = client.post("/api/v1/companies/company/ai/product-selection",
        json={"question": "Нужен станок", "amount": 2500000, "termMonths": 24})
    assert response.status_code == 200, response.text
    assert response.json()["product_ids"] == ["equipment_1"]
    assert client.post("/api/v1/companies/company/ai/product-selection", json={"amount": -1}).status_code == 422


def test_feedback_cannot_be_attached_to_someone_elses_response(api_client):
    client, db, user = api_client
    response = client.post("/api/v1/applications/app/ai/explanation", json={})
    db.added[0].actor_id = "another-user"
    assert client.post(f"/api/v1/ai/responses/{response.json()['response_id']}/feedback",
                       json={"helpful": False}).status_code == 404
