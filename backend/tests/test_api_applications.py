from __future__ import annotations

import uuid

from tests.api_helpers import create_draft


def test_list_applications(client, ip_headers, api):
    r = client.get(
        f"/api/v1/companies/{api.company_ip}/applications",
        headers=ip_headers,
    )
    assert r.status_code == 200
    ids = {a["id"] for a in r.json()}
    assert "app_draft_01" in ids
    assert "app_counter_01" in ids
    assert "app_rejected_01" not in ids  # чужой тенант


def test_create_draft(client, ip_headers, api):
    body = create_draft(
        client,
        ip_headers,
        company_id=api.company_ip,
        amount="1750000.00",
        term_months=18,
    )
    assert body["status"] == "DRAFT"
    assert body["companyId"] == api.company_ip
    assert body["productId"] == api.product_wc
    assert body["requestedAmount"] == "1750000.00"
    assert body["termMonths"] == 18
    assert body["version"] == 1


def test_create_draft_idempotency(client, ip_headers, api):
    key = f"pytest-create-{uuid.uuid4()}"
    first = create_draft(
        client,
        ip_headers,
        company_id=api.company_ip,
        idempotency_key=key,
    )
    second = create_draft(
        client,
        ip_headers,
        company_id=api.company_ip,
        amount="999999.00",  # игнор — тот же key
        idempotency_key=key,
    )
    assert first["id"] == second["id"]
    assert first["requestedAmount"] == second["requestedAmount"]


def test_submit_and_idempotency(client, ip_headers, api):
    draft = create_draft(client, ip_headers, company_id=api.company_ip)
    app_id = draft["id"]
    key = f"pytest-submit-{uuid.uuid4()}"

    r1 = client.post(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/submit",
        headers={**ip_headers, "Idempotency-Key": key},
    )
    assert r1.status_code == 202, r1.text
    p1 = r1.json()
    assert p1["applicationId"] == app_id
    assert p1["status"] != "DRAFT"
    assert p1["applicationNumber"]

    r2 = client.post(
        f"/api/v1/companies/{api.company_ip}/applications/{app_id}/submit",
        headers={**ip_headers, "Idempotency-Key": key},
    )
    assert r2.status_code == 202, r2.text
    p2 = r2.json()
    assert p2["applicationId"] == p1["applicationId"]
    assert p2["status"] == p1["status"]
    assert p2["applicationNumber"] == p1["applicationNumber"]


def test_seed_counteroffer_offers_visible(client, ip_headers, api):
    r = client.get(
        f"/api/v1/companies/{api.company_ip}/applications/app_counter_01/offers",
        headers=ip_headers,
    )
    assert r.status_code == 200
    offers = r.json()
    assert len(offers) >= 1
    offer = next(o for o in offers if o["id"] == "offer_counter_01")
    assert offer["status"] == "ACTIVE"
    assert offer["amount"] == "2500000.00"


def test_seed_counteroffer_decision(client, ip_headers, api):
    r = client.get(
        f"/api/v1/companies/{api.company_ip}/applications/app_counter_01/decision",
        headers=ip_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["decision"] == "COUNTEROFFERED"
    assert body["applicationId"] == "app_counter_01"


def test_ooo_cannot_see_ip_application(client, ooo_headers, api):
    r = client.get(
        f"/api/v1/companies/{api.company_ip}/applications/app_counter_01",
        headers=ooo_headers,
    )
    assert r.status_code in (403, 404)
