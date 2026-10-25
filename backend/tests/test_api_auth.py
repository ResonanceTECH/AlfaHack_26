from __future__ import annotations


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_ok(client, api):
    r = client.post(
        "/api/v1/auth/login",
        json={"login": "ip@demo.alfa", "password": api.password},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["accessToken"]
    assert body["user"]["role"] == "ENTREPRENEUR"
    assert body["user"]["fullName"]


def test_login_wrong_password(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"login": "ip@demo.alfa", "password": "wrong-password"},
    )
    assert r.status_code in (401, 403)


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_ok(client, ip_headers):
    r = client.get("/api/v1/auth/me", headers=ip_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "ENTREPRENEUR"
