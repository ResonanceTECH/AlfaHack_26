"""Integration smoke: auth, credit calc, draft/submit, empty statement bug."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

import httpx
import pytest

PASSWORD = "demo1234"
TWOPLACES = Decimal("0.01")


def _login(client: httpx.Client, login: str) -> str:
    r = client.post("/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["accessToken"]


@pytest.fixture(scope="module")
def client(api_base: str):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="module")
def ip_token(client: httpx.Client) -> str:
    return _login(client, "ip@demo.alfa")


def test_wrong_password(client: httpx.Client) -> None:
    r = client.post("/auth/login", json={"login": "ip@demo.alfa", "password": "wrong"})
    assert r.status_code == 401


def test_credit_annuity_matches_decimal(client: httpx.Client, ip_token: str) -> None:
    r = client.post(
        "/credit-calculations",
        headers={"Authorization": f"Bearer {ip_token}"},
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


def test_create_submit_idempotent(client: httpx.Client, ip_token: str) -> None:
    headers = {
        "Authorization": f"Bearer {ip_token}",
        "Idempotency-Key": "pytest-draft-idem-1",
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


def test_empty_statement_should_not_500(client: httpx.Client, ip_token: str) -> None:
    """FIN-02 regression: empty CSV must be 4xx/202 FAILED, not INTERNAL_ERROR 500."""
    files = {"file": ("empty.csv", b"", "text/csv")}
    r = client.post(
        "/companies/company_001/statements",
        headers={"Authorization": f"Bearer {ip_token}"},
        files=files,
    )
    assert r.status_code != 500, r.text
    assert r.status_code in (202, 400, 422)
    if r.status_code == 202:
        body = r.json()
        status_val = body.get("processingStatus") or body.get("processing_status")
        assert str(status_val).upper() == "FAILED"


def test_unsupported_statement_extension_422(client: httpx.Client, ip_token: str) -> None:
    """BUG-005: .exe rejected early with 422, no FAILED entity."""
    files = {"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")}
    r = client.post(
        "/companies/company_001/statements",
        headers={"Authorization": f"Bearer {ip_token}"},
        files=files,
    )
    assert r.status_code == 422, r.text
