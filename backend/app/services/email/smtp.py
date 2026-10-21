from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings
from app.core.phone import mask_email
from app.services.email.base import EmailDeliveryError, EmailProvider

logger = logging.getLogger("alfa.email.smtp")


class SmtpEmailProvider(EmailProvider):
    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        settings = get_settings()
        if not settings.smtp_host or not settings.smtp_from_email:
            raise EmailDeliveryError("SMTP не настроен (SMTP_HOST / SMTP_FROM_EMAIL)")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email
        msg["To"] = to
        msg.set_content(text_body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        try:
            if settings.smtp_use_tls:
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                    smtp.starttls()
                    if settings.smtp_username:
                        smtp.login(settings.smtp_username, settings.smtp_password)
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                    if settings.smtp_username:
                        smtp.login(settings.smtp_username, settings.smtp_password)
                    smtp.send_message(msg)
        except Exception as exc:
            logger.error("smtp_failed to=%s err=%s", mask_email(to), type(exc).__name__)
            raise EmailDeliveryError("Не удалось отправить письмо") from exc

        logger.info("smtp_sent to=%s", mask_email(to))
