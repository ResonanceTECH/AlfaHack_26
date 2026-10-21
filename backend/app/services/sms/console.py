from __future__ import annotations

import logging

from app.core.phone import mask_phone
from app.services.sms.base import SmsProvider

logger = logging.getLogger("alfa.sms.console")


class ConsoleSmsProvider(SmsProvider):
    async def send_verification_code(self, phone: str, code: str) -> None:
        logger.warning(
            "SMS_PROVIDER=console: verification code generated for %s "
            "(check DEBUG log or test capture store; not a real SMS)",
            mask_phone(phone),
        )
        logger.debug("console_sms destination=%s code_len=%s", mask_phone(phone), len(code))
        from app.services.sms.capture import capture_sms

        capture_sms(phone, code)
