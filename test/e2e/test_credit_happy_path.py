"""E2E API: entrepreneur draft → submit → analyst approve → accept → agreement."""

from __future__ import annotations

import uuid

import httpx
import pytest


@pytest.fixture(scope="module")
def client(api_base: str):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


def test_e2e_credit_approval_path(client: httpx.Client, tokens: dict) -> None:
    key = f"e2e-suite-{uuid.uuid4().hex[:10]}"
    h_ip = {"Authorization": f"Bearer {tokens['ip']}", "Idempotency-Key": key}
    h_an = {"Authorization": f"Bearer {tokens['analyst']}"}

    cos = client.get("/companies", headers={"Authorization": f"Bearer {tokens['ip']}"}).json()
    cid = cos[0]["id"]

    draft = client.post(
        f"/companies/{cid}/applications",
        headers=h_ip,
        json={
            "productId": "working_capital_01",
            "requestedAmount": 1750000,
            "termMonths": 12,
            "purpose": "e2e suite",
            "goalType": "other",
        },
    )
    assert draft.status_code == 201, draft.text
    app_id = draft.json()["id"]

    sub = client.post(
        f"/companies/{cid}/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={},
    )
    assert sub.status_code == 202
    assert sub.json()["status"] == "IN_REVIEW"

    asg = client.post(f"/analyst/applications/{app_id}/assign", headers=h_an, json={})
    assert asg.status_code == 200

    prop = client.post(
        f"/analyst/applications/{app_id}/propose",
        headers=h_an,
        json={
            "decision": "APPROVED",
            "offerAmount": 1750000,
            "offerTermMonths": 12,
            "offerRate": "19.5",
            "reasonCodes": ["DEMO_OK"],
            "explanation": "e2e",
        },
    )
    assert prop.status_code == 200
    assert prop.json()["status"] == "APPROVED"
    offer_id = prop.json()["offerId"]
    assert offer_id

    acc = client.post(
        f"/companies/{cid}/applications/{app_id}/offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={"offerVersion": 1, "acceptedTerms": True},
    )
    assert acc.status_code == 200
    assert acc.json()["status"] == "AGREEMENT_PREPARATION"

    ag = client.get(
        f"/companies/{cid}/applications/{app_id}/agreement",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
    )
    assert ag.status_code == 200

    conf = client.post(
        f"/companies/{cid}/applications/{app_id}/agreement/confirm",
        headers={"Authorization": f"Bearer {tokens['ip']}"},
        json={},
    )
    assert conf.status_code == 200
