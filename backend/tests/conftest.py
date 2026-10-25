"""Shared fixtures. Live API tests use QA docker stack on localhost:8000."""

from __future__ import annotations

import os

import pytest

API_BASE = os.environ.get("QA_API_BASE", "http://127.0.0.1:8000/api/v1")
DEMO_PASSWORD = "demo1234"


@pytest.fixture(scope="session")
def api_base() -> str:
    return API_BASE
