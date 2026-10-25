"""Shared fixtures: in-process TestClient + optional live QA API base."""

from __future__ import annotations

import os
from collections.abc import Generator
from typing import Any

# Env до импорта app (lru_cache settings + engine)
os.environ["APP_ENV"] = "test"
os.environ["DEMO_MODE"] = "true"
os.environ["JWT_SECRET_KEY"] = "pytest-jwt-secret-key-not-for-prod"
os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://alfa:alfa@localhost:5433/alfa_credit"
)
os.environ["REDIS_URL"] = "redis://localhost:6379/15"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

get_settings.cache_clear()

from app.db.session import get_db
from app.main import create_app
from app.models.user import User
from app.services.rate_limit import reset_rate_limits

API_BASE = os.environ.get("QA_API_BASE", "http://127.0.0.1:8000/api/v1")
DEMO_PASSWORD = "demo1234"
COMPANY_IP = "company_001"
COMPANY_OOO = "company_002"
PRODUCT_WC = "working_capital_01"
NEED_IP = "need_001"


@pytest.fixture(scope="session")
def api_base() -> str:
    """Live docker/QA API — integration/security/httpx tests."""
    return API_BASE


def _db_reachable(url: str) -> bool:
    try:
        eng = create_engine(url, pool_pre_ping=True)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except OperationalError:
        return False


@pytest.fixture(scope="session")
def database_url() -> str:
    url = get_settings().database_url
    if not _db_reachable(url):
        pytest.skip(
            f"Postgres недоступен ({url}). Подними: docker compose up -d db "
            "и прогони seed (api контейнер или python -m scripts.seed)"
        )
    return url


@pytest.fixture(scope="session")
def engine(database_url: str):
    eng = create_engine(database_url, pool_pre_ping=True)
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def SessionFactory(engine):
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)


@pytest.fixture(scope="session")
def ensure_seed(SessionFactory) -> None:
    """Демо-аккаунты должны быть в БД (seed)."""
    db = SessionFactory()
    try:
        user = db.scalar(select(User).where(User.login == "ip@demo.alfa"))
        if user is None:
            pytest.skip(
                "Seed не применён (нет ip@demo.alfa). "
                "Запусти: docker compose up api  или  python -m scripts.seed"
            )
    finally:
        db.close()


@pytest.fixture
def db(SessionFactory, ensure_seed) -> Generator[Session, None, None]:
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="session", autouse=True)
def _clear_rate_limits(ensure_seed):
    reset_rate_limits()
    yield
    reset_rate_limits()


@pytest.fixture(scope="session")
def app(SessionFactory, ensure_seed):
    application = create_app()

    def _override_db() -> Generator[Session, None, None]:
        session = SessionFactory()
        try:
            yield session
        finally:
            session.close()

    application.dependency_overrides[get_db] = _override_db
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    # function-scope: не тащим cookie/сессию между тестами
    with TestClient(app) as c:
        yield c


from tests.api_helpers import auth_headers  # noqa: E402


@pytest.fixture(scope="session")
def _session_tokens(app) -> dict[str, dict[str, str]]:
    """Один login на роль — иначе упрёмся в login rate-limit (10/15м)."""
    with TestClient(app) as c:
        return {
            "ip": auth_headers(c, "ip@demo.alfa"),
            "ooo": auth_headers(c, "ooo@demo.alfa"),
            "analyst": auth_headers(c, "analyst@demo.alfa"),
            "admin": auth_headers(c, "admin@demo.alfa"),
        }


@pytest.fixture
def ip_headers(_session_tokens) -> dict[str, str]:
    return _session_tokens["ip"]


@pytest.fixture
def ooo_headers(_session_tokens) -> dict[str, str]:
    return _session_tokens["ooo"]


@pytest.fixture
def analyst_headers(_session_tokens) -> dict[str, str]:
    return _session_tokens["analyst"]


@pytest.fixture
def admin_headers(_session_tokens) -> dict[str, str]:
    return _session_tokens["admin"]


@pytest.fixture
def api() -> Any:
    """Короткие константы для тестов."""

    class C:
        company_ip = COMPANY_IP
        company_ooo = COMPANY_OOO
        product_wc = PRODUCT_WC
        need_ip = NEED_IP
        password = DEMO_PASSWORD

    return C()
