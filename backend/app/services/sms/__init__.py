from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.services.sms.base import SmsDeliveryError, SmsProvider
from app.services.sms.console import ConsoleSmsProvider
from app.services.sms.mock import MockSmsProvider
from app.services.sms.smsru import SmsRuProvider

__all__ = [
    "SmsProvider",
    "SmsDeliveryError",
    "get_sms_provider",
    "MockSmsProvider",
]


@lru_cache
def get_sms_provider() -> SmsProvider:
    settings = get_settings()
    name = (settings.sms_provider or "").strip().lower()

    if settings.is_production and name in ("console", "mock", ""):
        raise RuntimeError(
            "В production запрещены SMS_PROVIDER=console/mock. "
            "Укажите реальный провайдер (например smsru) и SMS_API_KEY."
        )

    if name == "smsru":
        if not settings.sms_api_key:
            raise RuntimeError("SMS_PROVIDER=smsru требует SMS_API_KEY")
        return SmsRuProvider()
    if name == "mock":
        return MockSmsProvider()
    if name == "console":
        return ConsoleSmsProvider()

    raise RuntimeError(
        f"Неизвестный или ненастроенный SMS_PROVIDER={settings.sms_provider!r}. "
        "Допустимо: console (только development), mock (тесты), smsru."
    )


def reset_sms_provider_cache() -> None:
    get_sms_provider.cache_clear()
