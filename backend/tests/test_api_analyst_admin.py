from __future__ import annotations

import uuid

import pytest

from tests.api_helpers import auth_headers, create_draft


def test_analyst_cannot_admin_users(client, analyst_headers):
    r = client.get("/api/v1/admin/users", headers=analyst_headers)
    assert r.status_code == 403


def test_admin_products_and_policies(client, admin_headers):
    r_prod = client.get("/api/v1/admin/credit-products", headers=admin_headers)
    assert r_prod.status_code == 200
    prod = r_prod.json()
    assert prod["total"] >= 1
    assert any(p["id"] == "working_capital_01" for p in prod["items"])

    r_pol = client.get("/api/v1/admin/policies", headers=admin_headers)
    assert r_pol.status_code == 200
    assert r_pol.json()["total"] >= 1


def test_admin_demo_scenarios(client, admin_headers):
    r = client.get("/api/v1/admin/demo/scenarios", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_analyst_card_for_seed_app(client, analyst_headers):
    r = client.get(
        "/api/v1/analyst/applications/app_docs_01",
        headers=analyst_headers,
    )
    assert r.status_code == 200
    body = r.json()
    app = body.get("application") or body
    assert app["id"] == "app_docs_01"
    assert app["status"] == "DOCS_REQUESTED"


def test_counteroffer_propose_and_accept(client, ip_headers, analyst_headers, api):
    """create → submit → propose COUNTEROFFER → accept (+ idempotency)."""
    draft = create_draft(
        client,
        ip_headers,
        company_id=api.company_ip,
        amount="4500000.00",
        term_months=24,
        purpose="pytest counteroffer flow",
    )
    app_id = draft["id"]

    sub = client.post(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/submit",
        headers={
            **ip_headers,
            "Idempotency-Key": f"pytest-co-sub-{uuid.uuid4()}",
        },
    )
    assert sub.status_code == 202, sub.text
    status_after = sub.json()["status"]

    propose_allowed = {
        "SUBMITTED",
        "VALIDATING",
        "IN_REVIEW",
        "DOCS_REQUESTED",
        "COUNTEROFFERED",
        "APPROVED",
    }
    if status_after not in propose_allowed:
        pytest.skip(f"после submit статус {status_after}, propose недоступен")

    propose = client.post(
        f"/api/v1/analyst/applications/{app_id}/propose",
        headers=analyst_headers,
        json={
            "decision": "COUNTEROFFERED",
            "reasonCodes": ["AMOUNT_TOO_HIGH"],
            "explanation": "pytest: доступна меньшая сумма",
            "offerAmount": "2200000.00",
            "offerTermMonths": 12,
            "offerRate": "19.50",
            "productId": api.product_wc,
            "offerLabel": "pytest alternative",
        },
    )
    assert propose.status_code == 200, propose.text
    p = propose.json()
    assert p["decisionType"] == "COUNTEROFFERED"
    assert p["status"] == "COUNTEROFFERED"
    assert p["offerId"]
    offer_id = p["offerId"]

    ooo = auth_headers(client, "ooo@demo.alfa")
    r_ooo = client.get(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/offers",
        headers=ooo,
    )
    assert r_ooo.status_code in (403, 404)

    offers = client.get(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/offers",
        headers=ip_headers,
    )
    assert offers.status_code == 200
    offer = next(o for o in offers.json() if o["id"] == offer_id)
    offer_version = offer.get("offerVersion") or 1

    accept_key = f"pytest-accept-{uuid.uuid4()}"
    acc = client.post(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/offers/{offer_id}/accept",
        headers={**ip_headers, "Idempotency-Key": accept_key},
        json={"offerVersion": offer_version, "acceptedTerms": True},
    )
    assert acc.status_code == 200, acc.text
    assert acc.json()["offerId"] == offer_id
    assert acc.json()["applicationId"] == app_id

    acc2 = client.post(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/offers/{offer_id}/accept",
        headers={**ip_headers, "Idempotency-Key": accept_key},
        json={"offerVersion": offer_version, "acceptedTerms": True},
    )
    assert acc2.status_code == 200, acc2.text
    assert acc2.json()["offerId"] == offer_id
