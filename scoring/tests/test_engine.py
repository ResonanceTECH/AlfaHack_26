import dataclasses
import json

from credit_scoring import Decision, Product, load_config, score, to_jsonable
from credit_scoring.generator import generate_batch, personas
from credit_scoring.models import Application, ScoringInput

CFG = load_config()
BY_ID = {p.id: p for p in personas()}


def test_personas_hit_expected_branches():
    for p in personas():
        assert score(p.input, CFG).decision.value == p.expected_decision, p.id


def test_same_company_different_products_give_different_terms():
    base = BY_ID["ideal"].input
    offers = {}
    for prod in Product:
        app = dataclasses.replace(base.application, product=prod, amount=1_000_000, term_months=12)
        r = score(dataclasses.replace(base, application=app), CFG)
        assert r.decision == Decision.APPROVED and r.risk_band == "A"
        offers[prod] = r.offer.annual_rate
    assert len(set(offers.values())) == 4  # риск один, условия разные


def test_counter_offer_never_exceeds_limits():
    r = score(BY_ID["ambitious"].input, CFG)
    product = CFG["products"]["working_capital"]
    assert r.offer.amount < BY_ID["ambitious"].input.application.amount
    assert product["min_amount"] <= r.offer.amount <= product["max_amount"]
    assert "amount_reduced_to_limit" in r.reasons


def test_reject_still_explains_itself():
    r = score(BY_ID["overdue"].input, CFG)
    assert r.decision == Decision.REJECTED and r.offer is None
    assert [h.id for h in r.rule_hits] == ["overdue_now"] and r.factors


def test_missing_data_requests_clarification():
    r = score(BY_ID["incomplete"].input, CFG)
    assert r.decision == Decision.REQUEST_DATA and r.missing_data == ["financials"] and r.offer is None


def test_unavailable_bki_goes_to_manual_not_error():
    r = score(BY_ID["bki_down"].input, CFG)
    assert r.decision == Decision.MANUAL_REVIEW and r.offer is not None
    assert any(f.id == "debt_burden" and not f.applied for f in r.factors)


def test_product_min_age_rejects():
    base = BY_ID["young"].input
    app = dataclasses.replace(base.application, product=Product.EQUIPMENT)  # нужен год работы
    assert score(dataclasses.replace(base, application=app), CFG).decision == Decision.REJECTED


def test_factor_points_sum_to_score():
    for inp in generate_batch(200, seed=3):
        r = score(inp, CFG)
        if r.score is not None:
            assert r.score == CFG["base_score"] + sum(f.points for f in r.factors)


def test_more_overdue_and_more_debt_never_improve_score():
    checked = 0
    for inp in generate_batch(300, seed=11):
        if inp.bki is None or inp.egrul is None or inp.financials is None:
            continue
        base = score(inp, CFG).score
        worse_bki = dataclasses.replace(inp.bki, overdue_count_12m=inp.bki.overdue_count_12m + 2,
                                        monthly_payments=inp.bki.monthly_payments * 2,
                                        max_overdue_days_12m=max(1, inp.bki.max_overdue_days_12m))
        assert score(dataclasses.replace(inp, bki=worse_bki), CFG).score <= base
        checked += 1
    assert checked > 100


def test_bigger_request_never_improves_score():
    for inp in generate_batch(200, seed=5):
        if inp.egrul is None or inp.financials is None:
            continue
        app = dataclasses.replace(inp.application, amount=inp.application.amount * 3)
        assert score(dataclasses.replace(inp, application=app), CFG).score <= score(inp, CFG).score


def test_whole_batch_scores_without_errors_and_within_product_limits():
    counts = {}
    for inp in generate_batch(1000, seed=42):
        r = score(inp, CFG)
        counts[r.decision] = counts.get(r.decision, 0) + 1
        if r.offer:
            p = CFG["products"][inp.application.product.value]
            assert p["min_amount"] <= r.offer.amount <= p["max_amount"]
            assert p["min_term_months"] <= r.offer.term_months <= p["max_term_months"]
            assert r.offer.monthly_payment > 0
    assert set(counts) == set(Decision)  # на батче встречаются все исходы


def test_deterministic_and_does_not_mutate_input():
    inp = BY_ID["ideal"].input
    before = to_jsonable(inp)
    assert score(inp, CFG) == score(inp, CFG)
    assert to_jsonable(inp) == before


def test_result_is_json_serializable():
    json.dumps(to_jsonable(score(BY_ID["ambitious"].input, CFG)), ensure_ascii=False)


def test_invalid_application_is_rejected_at_construction():
    for kwargs in ({"amount": 0, "term_months": 12}, {"amount": 1000, "term_months": 0}):
        try:
            Application(Product.EXPRESS, **kwargs)
        except ValueError:
            continue
        raise AssertionError("should raise")


def test_from_dict_roundtrip():
    inp = BY_ID["ambitious"].input
    assert ScoringInput.from_dict(to_jsonable(inp)) == inp
