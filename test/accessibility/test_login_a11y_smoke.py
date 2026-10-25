"""Basic accessibility smoke on login HTML (no full WCAG claim)."""

from __future__ import annotations

import os
import re

import httpx
import pytest


def _frontend() -> str:
    # Prefer compose service DNS when running inside api container
    return os.environ.get("QA_FRONTEND_URL", "http://frontend")


def test_login_page_has_shell() -> None:
    url = _frontend().rstrip("/") + "/login"
    try:
        r = httpx.get(url, timeout=10.0)
    except httpx.HTTPError as exc:
        pytest.skip(f"frontend unreachable at {url}: {exc}")
    assert r.status_code == 200
    html = r.text
    assert "root" in html or "script" in html.lower()


def test_document_title() -> None:
    url = _frontend().rstrip("/") + "/"
    try:
        r = httpx.get(url, timeout=10.0)
    except httpx.HTTPError as exc:
        pytest.skip(f"frontend unreachable at {url}: {exc}")
    assert r.status_code == 200
    m = re.search(r"<title>(.*?)</title>", r.text, re.I | re.S)
    assert m, "missing <title>"
    assert m.group(1).strip()


@pytest.mark.skip(reason="Full axe-core / WCAG 2.2 AA requires browser tooling")
def test_axe_core_full_scan() -> None:
    assert False
