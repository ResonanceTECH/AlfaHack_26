from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.services.email.base import EmailDeliveryError, EmailProvider
from app.services.email.console import ConsoleEmailProvider
from app.services.email.mock import MockEmailProvider
from app.services.email.smtp import SmtpEmailProvider

__all__ = [
    "EmailProvider",
    "EmailDeliveryError",
    "get_email_provider",
    "MockEmailProvider",
]


@lru_cache
def get_email_provider() -> EmailProvider:
    settings = get_settings()
    name = (settings.email_provider or "").strip().lower()

    if settings.is_production and name in ("console", "mock", ""):
        raise RuntimeError(
            "В production запрещены EMAIL_PROVIDER=console/mock. Укажите smtp и SMTP_*."
        )

    if name == "smtp":
        return SmtpEmailProvider()
    if name == "mock":
        return MockEmailProvider()
    if name == "console":
        return ConsoleEmailProvider()

    raise RuntimeError(
        f"Неизвестный EMAIL_PROVIDER={settings.email_provider!r}. "
        "Допустимо: console (development), mock (тесты), smtp."
    )


def reset_email_provider_cache() -> None:
    get_email_provider.cache_clear()
