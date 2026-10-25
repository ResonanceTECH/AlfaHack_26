"""API contract: critical paths exist in OpenAPI + live method checks."""

from __future__ import annotations

import httpx
import pytest

REQUIRED_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/me",
    "/api/v1/companies",
    "/api/v1/credit-products",
    "/api/v1/credit-calculations",
    "/api/v1/companies/{company_id}/applications",
    "/api/v1/companies/{company_id}/applications/{application_id}/submit",
    "/api/v1/companies/{company_id}/applications/{application_id}/offers/{offer_id}/accept",
    "/api/v1/analyst/applications",
    "/api/v1/analyst/applications/{application_id}/propose",
    "/api/v1/admin/users",
    "/api/v1/admin/policies",
    "/health",
]


@pytest.fixture(scope="module")
def openapi():
    # Inside compose network API listens on itself
    for url in ("http://127.0.0.1:8000/openapi.json", "http://api:8000/openapi.json"):
        try:
            r = httpx.get(url, timeout=10.0)
            if r.status_code == 200:
                return r.json()
        except httpx.HTTPError:
            continue
    pytest.fail("openapi.json unreachable")


def test_openapi_has_required_paths(openapi: dict) -> None:
    paths = openapi.get("paths", {})
    missing = [p for p in REQUIRED_PATHS if p not in paths]
    assert not missing, f"Missing OpenAPI paths: {missing}"


def test_openapi_path_count(openapi: dict) -> None:
    assert len(openapi.get("paths", {})) >= 100


def test_login_response_has_tokens(tokens: dict) -> None:
    assert tokens["ip"]
    assert tokens["analyst"]
    assert tokens["admin"]


def test_error_envelope_on_validation(api_base: str, tokens: dict) -> None:
    r = httpx.post(
        f"{api_base}/credit-calculations",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={"amount": -1, "termMonths": 12, "annualRatePercent": 10, "repaymentType": "annuity"},
        timeout=30.0,
    )
    assert r.status_code == 422
    body = r.json()
    assert "error" in body
    assert body["error"].get("code")
