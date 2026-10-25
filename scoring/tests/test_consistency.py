from dataclasses import replace
from datetime import date
from itertools import product
import copy

import pytest

from credit_scoring import Decision, load_config, score
from credit_scoring.config import ConfigError, validate_config
from credit_scoring.engine import compute_features, score_factors
from credit_scoring.generator import generate_batch, personas
from credit_scoring.models import Application, BkiReport, EgrulInfo, Financials, Product


BASE = personas()[0].input


def test_underage_business_has_no_growth_even_if_previous_revenue_is_supplied():
    inp = replace(BASE, egrul=replace(BASE.egrul, registration_date=date(2026, 3, 25)))
    result = score(inp)
    growth = next(f for f in result.factors if f.id == "revenue_growth")
    assert growth.value is None and growth.points == 0 and not growth.applied
    assert result.score_complete  # неприменимость по возрасту не означает отсутствие источника


def test_generator_never_gives_previous_revenue_to_business_under_one_year():
    cfg = load_config()
    for inp in generate_batch(1000, seed=42):
        if inp.financials and compute_features(inp, cfg)["company_age_months"] < 12:
            assert inp.financials.revenue_prev_12m == 0


@pytest.mark.parametrize("count,days,current", [(0, 40, False), (2, 0, False), (0, 0, True), (-1, 1, False)])
def test_impossible_credit_history_is_rejected(count, days, current):
    with pytest.raises(ValueError):
        BkiReport(1, 1000, current, count, days)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -1])
def test_nonfinite_or_negative_money_is_rejected(value):
    with pytest.raises(ValueError):
        Application(Product.EXPRESS, value, 12)
    with pytest.raises(ValueError):
        Financials(value, 0, 0)


def test_credit_history_cap_is_configurable_and_explained():
    inp = replace(BASE, bki=replace(BASE.bki, overdue_count_12m=3, max_overdue_days_12m=40))
    result = score(inp)
    history = [f for f in result.factors if f.id in ("overdue_count", "max_overdue_days")]
    assert sum(f.points for f in history) == -60
    assert any(f.raw_points is not None and f.raw_points < f.points for f in history)
    assert result.score == 500 + sum(f.points for f in result.factors)
    cfg = load_config()
    cfg["factor_groups"][0]["min_points"] = -80
    validate_config(cfg)
    assert score(inp, cfg).score == result.score - 20


@pytest.mark.parametrize("missing", ["bki", "fns", "financials", "egrul"])
def test_missing_sources_mark_score_incomplete(missing):
    assert score(BASE).score_complete
    assert not score(replace(BASE, **{missing: None})).score_complete


def test_counter_offer_uses_new_risk_band_rate_and_automation():
    inp = replace(BASE,
        egrul=EgrulInfo("active", date(2025, 4, 25), "47.11"),
        financials=Financials(12_000_000, 11_500_000, 11_000_000),
        bki=BkiReport(1, 200_000, False, 0, 0),
        application=Application(Product.WORKING_CAPITAL, 9_000_000, 36))
    result = score(inp)
    assert result.risk_band == "C" and result.offer_risk_band == "B"
    assert result.decision == Decision.COUNTER_OFFER
    assert result.offer.annual_rate == .19
    candidate = replace(inp, application=replace(inp.application, amount=result.offer.amount,
                                                term_months=result.offer.term_months))
    rerun = score(candidate)
    assert rerun.decision == Decision.APPROVED
    assert rerun.score == result.offer_score
    assert rerun.factors == result.offer_factors
    assert result.offer_score == 500 + sum(f.points for f in result.offer_factors)


def test_every_generated_offer_matches_its_rescored_policy():
    cfg = load_config()
    for inp in generate_batch(1000, seed=42):
        result = score(inp, cfg)
        if result.offer is None:
            assert result.offer_score is None and result.offer_risk_band is None
            continue
        candidate = replace(inp, application=replace(inp.application, amount=result.offer.amount,
                                                    term_months=result.offer.term_months))
        rerun = score(candidate, cfg)
        assert rerun.score == result.offer_score
        assert rerun.risk_band == result.offer_risk_band
        policy = cfg["products"][inp.application.product.value]["bands"][result.offer_risk_band]
        assert result.offer.annual_rate == policy["annual_rate"]
        assert result.offer.amount <= policy["max_revenue_multiple"] * inp.financials.revenue_12m / 12
        assert result.offer.term_months <= policy["max_term_months"]


def test_consistent_extreme_score_range():
    cfg = load_config()
    # Все корзины возраста/динамики с учётом ограничения истории и применимости роста.
    # Остальные факторы берутся в худшем и лучшем согласованном сочетании.
    scores = []
    for age, growth, best in product((6, 18, 36, 72), (-.3, -.1, .05, .2, .4), (False, True)):
        year, month = divmod(2026 * 12 + 9 - age, 12)
        inp = replace(BASE,
            egrul=EgrulInfo("active", date(year, month + 1, 25), "62.01" if best else "43.21"),
            financials=Financials(12_000_000, 12_000_000 / (1 + growth) if age >= 12 else 0,
                                  8_000_000 if best else 15_000_000),
            bki=BkiReport(1, 0 if best else 500_000, False, 0 if best else 3, 0 if best else 40),
            application=Application(Product.WORKING_CAPITAL, 500_000 if best else 9_000_000, 12))
        scores.append(score(inp, cfg).score)
    assert min(scores) == 220 and max(scores) == 685


@pytest.mark.parametrize("mutation", ["unknown", "overlap", "positive", "duplicate"])
def test_invalid_factor_groups_are_rejected(mutation):
    cfg = copy.deepcopy(load_config())
    if mutation == "unknown":
        cfg["factor_groups"][0]["factors"].append("missing")
    elif mutation == "overlap":
        cfg["factor_groups"].append({**cfg["factor_groups"][0], "id": "other"})
    elif mutation == "positive":
        cfg["factor_groups"][0]["min_points"] = 1
    else:
        cfg["factor_groups"][0]["factors"].append("overdue_count")
    with pytest.raises(ConfigError):
        validate_config(cfg)
