from __future__ import annotations

from app.services.sms.base import SmsDeliveryError, SmsProvider
from app.services.sms.capture import capture_sms


class MockSmsProvider(SmsProvider):

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.sent: list[tuple[str, str]] = []

    async def send_verification_code(self, phone: str, code: str) -> None:
        if self.fail:
            raise SmsDeliveryError("SMS provider unavailable (mock failure)")
        self.sent.append((phone, code))
        capture_sms(phone, code)
