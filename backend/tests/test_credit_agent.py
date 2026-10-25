import json
from dataclasses import replace

import httpx
import pytest

from credit_scoring import score, to_jsonable
from credit_scoring.generator import personas, generate_batch
from app.services.credit_agent import AgentConfig, scoring_context, catalog_context, verified_changes, run_agent
from app.services.credit_agent.agent import template_answer
from app.services.credit_agent.client import LocalLLM


class FakeLLM:
    def __init__(self, transform=None, failures=0):
        self.transform, self.failures, self.calls = transform, failures, 0

    def generate(self, context, **kwargs):
        self.calls += 1
        if self.calls <= self.failures:
            raise httpx.ReadTimeout("test timeout")
        answer = template_answer(context).model_dump()
        if self.transform:
            self.transform(answer)
        return json.dumps(answer, ensure_ascii=False)


def make_context(persona="ideal", *, analyst=False, question=""):
    inp = next(p.input for p in personas() if p.id == persona)
    result = to_jsonable(score(inp))
    return scoring_context(result, analyst=analyst, question=question,
                           simulations=verified_changes(inp, result))


@pytest.mark.parametrize("inp", [p.input for p in personas()] + generate_batch(2, seed=7))
@pytest.mark.parametrize("analyst", [False, True])
def test_twenty_reference_cases_preserve_facts(inp, analyst):
    result = to_jsonable(score(inp))
    ctx = scoring_context(result, analyst=analyst)
    run = run_agent(ctx, AgentConfig(enabled=True), llm=FakeLLM())
    assert run.response.mode == "llm"
    assert not run.response.validation_errors
    assert ctx["canonical_summary"] in run.response.summary
    facts = {f["id"] for f in ctx["facts"]}
    assert {r.source_id for r in run.response.main_reasons} <= facts
    mandatory = {f["id"] for f in ctx["facts"] if f["kind"] == "rule" or ":missing:" in f["id"]}
    assert mandatory <= {r.source_id for r in run.response.main_reasons}
    assert run.audit["input"] == ctx


def test_client_context_contains_no_scores_thresholds_or_identity():
    ctx = make_context("young")
    raw = json.dumps(ctx, ensure_ascii=False)
    assert "525" not in raw and "score\"" not in raw
    assert "raw_points" not in raw and "registration_date" not in raw
    assert "7700000005" not in raw
    assert "меньше 3" not in json.dumps(make_context("liquidating"), ensure_ascii=False)
    assert "баллов" in json.dumps(make_context(analyst=True), ensure_ascii=False)
    assert "4000000 ₽" in json.dumps(make_context("ambitious"), ensure_ascii=False)


def test_disabled_never_calls_llm_and_incomplete_warning_cannot_be_omitted():
    fake = FakeLLM()
    response = run_agent(make_context("bki_down"), AgentConfig(), llm=fake).response
    assert fake.calls == 0 and response.mode == "template"
    assert response.score_complete is False and "неполные" in response.summary
    assert not response.validation_errors


@pytest.mark.parametrize("transform,error", [
    (lambda a: a["main_reasons"][0].update(source_id="fake"), "unknown_source"),
    (lambda a: a["main_reasons"][0].update(text="Сумма 987654321 ₽"), "ungrounded_number"),
    (lambda a: a.update(summary="Вам точно одобрят кредит"), "approval_promise"),
    (lambda a: a.update(summary="Внутренний порог скоринга"), "internal_policy_disclosure"),
    (lambda a: a.update(next_steps=["send_email"]), "unknown_action"),
    (lambda a: a.update(product_ids=["invented"]), "unknown_product"),
    (lambda a: a.update(summary="Позвоните сотруднику"), "external_channel"),
    (lambda a: a.update(summary="<think>мысли</think>"), "thinking_output"),
    (lambda a: a.update(what_to_change=[a["main_reasons"][0]]), "unverified_change"),
])
def test_bad_generations_fall_back(transform, error):
    run = run_agent(make_context(), AgentConfig(enabled=True), llm=FakeLLM(transform))
    assert run.response.mode == "template"
    assert error in run.response.validation_errors
    assert run.audit["raw_response"]


def test_critical_stop_rule_cannot_be_omitted():
    fake = FakeLLM(lambda a: a.update(main_reasons=[]))
    response = run_agent(make_context("overdue"), AgentConfig(enabled=True), llm=fake).response
    assert response.mode == "template"
    assert "missing_critical_reasons" in response.validation_errors
    assert any(r.rule_id == "overdue_now" for r in response.main_reasons)


@pytest.mark.parametrize("failures,mode,calls", [(1, "llm", 2), (2, "template", 2)])
def test_timeout_has_only_one_retry(failures, mode, calls):
    fake = FakeLLM(failures=failures)
    response = run_agent(make_context(), AgentConfig(enabled=True), llm=fake).response
    assert fake.calls == calls and response.mode == mode


def test_actual_http_payload_and_json_schema_without_network():
    ctx = make_context()
    def handle(request):
        body = json.loads(request.content)
        assert request.url.path == "/v1/chat/completions"
        assert body["response_format"]["type"] == "json_schema"
        assert body["stream"] is False and body["temperature"] == .1
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {
            "content": template_answer(ctx).model_dump_json()}}]})
    cfg = AgentConfig(enabled=True)
    run = run_agent(ctx, cfg, llm=LocalLLM(cfg, transport=httpx.MockTransport(handle)))
    assert run.response.mode == "llm"


@pytest.mark.parametrize("status,body", [(200, {}), (200, {"choices": []}),
    (200, {"choices": [{"finish_reason": "stop", "message": {"content": "not json"}}]}),
    (200, {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]}), (503, {})])
def test_bad_server_responses_fall_back(status, body):
    cfg = AgentConfig(enabled=True)
    transport = httpx.MockTransport(lambda r: httpx.Response(status, json=body))
    assert run_agent(make_context(), cfg, llm=LocalLLM(cfg, transport=transport)).response.mode == "template"


def test_verified_changes_are_score_results_and_old_policies_are_not_recomputed():
    inp = next(p.input for p in personas() if p.id == "ambitious")
    result = to_jsonable(score(inp))
    changes = verified_changes(inp, result)
    assert changes and all(f.kind == "simulation" for f in changes)
    assert verified_changes(inp, {**result, "config_version": "old-version"}) == []
    ctx = scoring_context(result, simulations=changes)
    run = run_agent(ctx, AgentConfig(enabled=True), llm=FakeLLM())
    assert run.response.what_to_change


PRODUCTS = [{"id": "equipment_1", "name": "Оборудование", "status": "PUBLISHED", "is_active": True,
             "suitable_goals": ["equipment"], "amount_min": 500000, "amount_max": 10000000,
             "term_min": 6, "term_max": 60, "rate_min": 14., "rate_max": 20.}]


def test_catalog_is_the_only_source_and_prefill_comes_from_user():
    ctx = catalog_context(PRODUCTS, question="Нужен кредит на станок: 2,5 млн на 24 месяца")
    response = run_agent(ctx, AgentConfig(enabled=True), llm=FakeLLM()).response
    assert response.product_ids == ["equipment_1"]
    assert response.prefill == {"product_id": "equipment_1", "goal_type": "equipment", "amount": 2500000., "term_months": 24}
    assert response.mode == "llm"


def test_missing_parameters_are_asked_and_unpublished_products_are_excluded():
    ctx = catalog_context([{**PRODUCTS[0], "status": "DRAFT"}], question="Нужен станок")
    response = run_agent(ctx).response
    assert not response.product_ids
    assert "Уточните необходимую сумму финансирования." in response.next_steps
    assert "Уточните желаемый срок в месяцах." in response.next_steps


def test_selection_continues_from_previous_confirmable_prefill():
    ctx = catalog_context(PRODUCTS, question="На 24 месяца", prior_prefill={"goal_type": "equipment", "amount": 2500000.})
    assert ctx["prefill"]["term_months"] == 24
    assert ctx["prefill"]["amount"] == 2500000.


def test_unknown_topic_does_not_call_llm():
    fake = FakeLLM()
    response = run_agent(make_context(question="Какая погода завтра?"), AgentConfig(enabled=True), llm=fake).response
    assert fake.calls == 0 and "нет ответа" in response.summary
    assert not response.main_reasons


def test_cli_returns_json_without_database(monkeypatch, capsys):
    import sys
    from app.services.credit_agent.cli import main
    monkeypatch.setattr(sys, "argv", ["credit-agent", "client", "--persona", "ambitious"])
    main()
    result = json.loads(capsys.readouterr().out)
    assert result["mode"] == "template"
    assert result["what_to_change"]
