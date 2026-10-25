"""Shared fixtures for QA suite in test/."""

from __future__ import annotations

import os
import uuid

import httpx
import pytest

API_BASE = os.environ.get("QA_API_BASE", "http://127.0.0.1:8000/api/v1")
# From api container compose network use service name; from host use localhost.
FRONTEND_URL = os.environ.get("QA_FRONTEND_URL", "http://127.0.0.1:8080")
DEMO_PASSWORD = "demo1234"


@pytest.fixture(scope="session")
def api_base() -> str:
    return API_BASE


@pytest.fixture(scope="session")
def frontend_url() -> str:
    return FRONTEND_URL


@pytest.fixture(scope="session")
def http() -> httpx.Client:
    with httpx.Client(timeout=30.0) as c:
        yield c


def _login(client: httpx.Client, api_base: str, login: str) -> str:
    # retry once after soft wait if rate-limited
    for attempt in range(3):
        r = client.post(
            f"{api_base}/auth/login",
            json={"login": login, "password": DEMO_PASSWORD},
        )
        if r.status_code == 200:
            return r.json()["accessToken"]
        if r.status_code == 429:
            import time

            time.sleep(1.5 * (attempt + 1))
            continue
        raise AssertionError(f"login {login} failed: {r.status_code} {r.text}")
    raise AssertionError(f"login {login} rate-limited")


@pytest.fixture(scope="session")
def tokens(http: httpx.Client, api_base: str) -> dict[str, str]:
    return {
        "ip": _login(http, api_base, "ip@demo.alfa"),
        "ooo": _login(http, api_base, "ooo@demo.alfa"),
        "analyst": _login(http, api_base, "analyst@demo.alfa"),
        "admin": _login(http, api_base, "admin@demo.alfa"),
    }


@pytest.fixture
def idem_key() -> str:
    return f"qa-{uuid.uuid4().hex[:12]}"
