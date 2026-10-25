from __future__ import annotations

import logging

import httpx

from app.config import get_settings
from app.core.phone import mask_phone
from app.services.sms.base import SmsDeliveryError, SmsProvider

logger = logging.getLogger("alfa.sms.smsru")


class SmsRuProvider(SmsProvider):
    async def send_verification_code(self, phone: str, code: str) -> None:
        settings = get_settings()
        if not settings.sms_api_key:
            raise SmsDeliveryError("SMS_API_KEY не настроен")

        digits = phone.lstrip("+")
        text = f"Код подтверждения Линия решения: {code}. Никому не сообщайте код."
        params = {
            "api_id": settings.sms_api_key,
            "to": digits,
            "msg": text,
            "json": 1,
        }
        if settings.sms_sender:
            params["from"] = settings.sms_sender

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get("https://sms.ru/sms/send", params=params)
                data = resp.json()
        except Exception as exc:
            logger.error("smsru_request_failed destination=%s err=%s", mask_phone(phone), type(exc).__name__)
            raise SmsDeliveryError("Не удалось отправить SMS") from exc

        status_code = data.get("status")
        if status_code != "OK":
            logger.error(
                "smsru_rejected destination=%s status=%s code=%s",
                mask_phone(phone),
                status_code,
                data.get("status_code"),
            )
            raise SmsDeliveryError("SMS-провайдер отклонил отправку")

        logger.info("smsru_sent destination=%s", mask_phone(phone))
