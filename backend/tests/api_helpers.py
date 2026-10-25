from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

DEMO_PASSWORD = "demo1234"
PRODUCT_WC = "working_capital_01"


def auth_headers(client: TestClient, login: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    r = client.post("/api/v1/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def create_draft(
    client: TestClient,
    headers: dict[str, str],
    *,
    company_id: str,
    product_id: str = PRODUCT_WC,
    amount: str = "1500000.00",
    term_months: int = 12,
    idempotency_key: str | None = None,
    purpose: str = "pytest draft",
) -> dict[str, Any]:
    h = dict(headers)
    if idempotency_key:
        h["Idempotency-Key"] = idempotency_key
    r = client.post(
        f"/api/v1/companies/{company_id}/applications",
        headers=h,
        json={
            "productId": product_id,
            "requestedAmount": amount,
            "termMonths": term_months,
            "purpose": purpose,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()
