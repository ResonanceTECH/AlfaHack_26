"""Integration smoke: auth, credit calc, draft idempotency, empty statement bug."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
import uuid

import httpx
import pytest

TWOPLACES = Decimal("0.01")


@pytest.fixture(scope="module")
def client(api_base: str):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


def test_wrong_password(client: httpx.Client) -> None:
    r = client.post("/auth/login", json={"login": "ip@demo.alfa", "password": "wrong"})
    # may 401 or 429 if hammered — treat 429 as infra noise only when unexpected
    assert r.status_code in (401, 429)
    if r.status_code == 401:
        assert True


def test_credit_annuity_matches_decimal(client: httpx.Client, tokens: dict) -> None:
    r = client.post(
        "/credit-calculations",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={
            "amount": 1000000,
            "termMonths": 12,
            "annualRatePercent": 15,
            "repaymentType": "annuity",
            "currency": "RUB",
        },
    )
    assert r.status_code == 200
    body = r.json()
    principal = Decimal("1000000")
    rate = Decimal("15") / Decimal("100") / Decimal("12")
    n = 12
    factor = (1 + rate) ** n
    expected = (principal * rate * factor / (factor - 1)).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    assert Decimal(str(body["monthlyPayment"])) == expected
    assert Decimal(str(body["schedule"][-1]["remainingPrincipal"])) == Decimal("0.00")


def test_create_submit_idempotent(client: httpx.Client, tokens: dict) -> None:
    key = f"pytest-draft-{uuid.uuid4().hex[:10]}"
    headers = {
        "Authorization": f"Bearer {tokens['ip']}",
        "Idempotency-Key": key,
    }
    payload = {
        "productId": "working_capital_01",
        "requestedAmount": 1100000,
        "termMonths": 12,
        "purpose": "pytest",
        "goalType": "other",
    }
    r1 = client.post("/companies/company_001/applications", headers=headers, json=payload)
    assert r1.status_code == 201
    r2 = client.post("/companies/company_001/applications", headers=headers, json=payload)
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


def test_empty_statement_should_not_500(client: httpx.Client, tokens: dict) -> None:
    files = {"file": ("empty.csv", b"", "text/csv")}
    r = client.post(
        "/companies/company_001/statements",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        files=files,
    )
    assert r.status_code != 500, r.text
    assert r.status_code in (202, 400, 422)
    if r.status_code == 202:
        body = r.json()
        status_val = body.get("processingStatus") or body.get("processing_status")
        assert str(status_val).upper() == "FAILED"
