from __future__ import annotations


def test_entrepreneur_cannot_access_admin(client, ip_headers):
    r = client.get("/api/v1/admin/users", headers=ip_headers)
    assert r.status_code == 403


def test_entrepreneur_cannot_access_analyst_queue(client, ip_headers):
    r = client.get("/api/v1/analyst/applications", headers=ip_headers)
    assert r.status_code == 403


def test_tenant_isolation_companies_list(client, ip_headers, ooo_headers, api):
    r_ip = client.get("/api/v1/companies", headers=ip_headers)
    r_ooo = client.get("/api/v1/companies", headers=ooo_headers)
    assert r_ip.status_code == 200
    assert r_ooo.status_code == 200
    ip_ids = {c["id"] for c in r_ip.json()}
    ooo_ids = {c["id"] for c in r_ooo.json()}
    assert api.company_ip in ip_ids
    assert api.company_ooo not in ip_ids
    assert api.company_ooo in ooo_ids
    assert api.company_ip not in ooo_ids


def test_tenant_isolation_foreign_company(client, ooo_headers, api):
    # чужая компания — 403 или безопасный 404
    r = client.get(f"/api/v1/companies/{api.company_ip}", headers=ooo_headers)
    assert r.status_code in (403, 404)


def test_tenant_isolation_foreign_applications(client, ooo_headers, api):
    r = client.get(
        f"/api/v1/companies/{api.company_ip}/applications",
        headers=ooo_headers,
    )
    assert r.status_code in (403, 404)


def test_admin_cannot_use_client_company_api(client, admin_headers, api):
    r = client.get(f"/api/v1/companies/{api.company_ip}", headers=admin_headers)
    assert r.status_code == 403


def test_admin_users_ok(client, admin_headers):
    r = client.get("/api/v1/admin/users", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 4
    logins = {u.get("login") for u in body["items"]}
    assert "admin@demo.alfa" in logins


def test_analyst_queue_ok(client, analyst_headers):
    r = client.get("/api/v1/analyst/applications", headers=analyst_headers)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 1
