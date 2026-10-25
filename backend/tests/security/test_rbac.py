"""Security: RBAC + tenant isolation against live QA API."""

from __future__ import annotations

import httpx
import pytest

PASSWORD = "demo1234"


def _login(client: httpx.Client, login: str) -> str:
    r = client.post("/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["accessToken"]


@pytest.fixture(scope="module")
def client(api_base: str):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="module")
def tokens(client: httpx.Client):
    return {
        "ip": _login(client, "ip@demo.alfa"),
        "ooo": _login(client, "ooo@demo.alfa"),
        "analyst": _login(client, "analyst@demo.alfa"),
        "admin": _login(client, "admin@demo.alfa"),
    }


def test_entrepreneur_denied_analyst(client: httpx.Client, tokens: dict) -> None:
    r = client.get("/analyst/applications", headers={"Authorization": f"Bearer {tokens['ip']}"})
    assert r.status_code == 403


def test_entrepreneur_denied_admin(client: httpx.Client, tokens: dict) -> None:
    r = client.get("/admin/users", headers={"Authorization": f"Bearer {tokens['ip']}"})
    assert r.status_code == 403


def test_analyst_denied_policy(client: httpx.Client, tokens: dict) -> None:
    r = client.get("/admin/policies", headers={"Authorization": f"Bearer {tokens['analyst']}"})
    assert r.status_code == 403


def test_admin_denied_client_companies(client: httpx.Client, tokens: dict) -> None:
    r = client.get("/companies", headers={"Authorization": f"Bearer {tokens['admin']}"})
    assert r.status_code == 403


def test_foreign_company_financials_404(client: httpx.Client, tokens: dict) -> None:
    r = client.get(
        "/companies/company_002/financials",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
    )
    assert r.status_code == 404


def test_foreign_application_404(client: httpx.Client, tokens: dict) -> None:
    r = client.get(
        "/companies/company_002/applications/app_rejected_01",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
    )
    # seed rejected id may differ; any foreign id
    apps = client.get(
        "/companies/company_002/applications",
        headers={"Authorization": f"Bearer {tokens['ooo']}"},
    ).json()
    if not apps:
        pytest.skip("no ooo apps")
    aid = apps[0]["id"]
    r = client.get(
        f"/companies/company_002/applications/{aid}",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
    )
    assert r.status_code == 404


def test_self_elevate_denied(client: httpx.Client, tokens: dict) -> None:
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['ip']}"}).json()
    r = client.patch(
        f"/admin/users/{me['id']}",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={"role": "ADMIN"},
    )
    assert r.status_code == 403


def test_entrepreneur_cannot_propose(client: httpx.Client, tokens: dict) -> None:
    r = client.post(
        "/analyst/applications/app_approved_01/propose",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={"decision": "APPROVED", "offerAmount": 100000, "offerTermMonths": 6, "offerRate": 20},
    )
    assert r.status_code in (403, 404)
