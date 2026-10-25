"""Exploratory / negative: double-submit, stale version, spam, bad payloads."""

from __future__ import annotations

import uuid

import httpx
import pytest


@pytest.fixture(scope="module")
def client(api_base: str):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


def test_exp01_ten_rapid_credit_calcs(client: httpx.Client, tokens: dict) -> None:
    h = {"Authorization": f"Bearer {tokens['ip']}"}
    codes = []
    for _ in range(10):
        r = client.post(
            "/credit-calculations",
            headers=h,
            json={
                "amount": 1000000,
                "termMonths": 12,
                "annualRatePercent": 15,
                "repaymentType": "annuity",
            },
        )
        codes.append(r.status_code)
    assert all(c == 200 for c in codes), codes


def test_exp06_backend_500_shape_on_empty_statement(client: httpx.Client, tokens: dict) -> None:
    r = client.post(
        "/companies/company_001/statements",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert r.status_code in (500, 422, 202)
    if r.status_code == 500:
        assert r.json().get("error", {}).get("code") == "INTERNAL_ERROR"


def test_exp08_conflict_on_stale_version(client: httpx.Client, tokens: dict) -> None:
    key = f"exp-stale-{uuid.uuid4().hex[:10]}"
    h = {"Authorization": f"Bearer {tokens['ip']}", "Idempotency-Key": key}
    d = client.post(
        "/companies/company_001/applications",
        headers=h,
        json={
            "productId": "working_capital_01",
            "requestedAmount": 600000,
            "termMonths": 6,
            "purpose": "exp",
            "goalType": "other",
        },
    )
    assert d.status_code == 201, d.text
    app = d.json()
    aid, ver = app["id"], app["version"]
    auth = {"Authorization": f"Bearer {tokens['ip']}"}
    p1 = client.patch(
        f"/companies/company_001/applications/{aid}",
        headers=auth,
        json={"purpose": "v1", "version": ver},
    )
    assert p1.status_code == 200
    p2 = client.patch(
        f"/companies/company_001/applications/{aid}",
        headers=auth,
        json={"purpose": "stale", "version": ver},
    )
    assert p2.status_code == 409


def test_exp13_garbage_token(client: httpx.Client) -> None:
    r = client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_exp16_extra_fields_tolerated_or_ignored(client: httpx.Client, tokens: dict) -> None:
    r = client.post(
        "/credit-calculations",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={
            "amount": 1000000,
            "termMonths": 12,
            "annualRatePercent": 15,
            "repaymentType": "annuity",
            "unknownHackField": "x",
        },
    )
    assert r.status_code in (200, 422)
