from __future__ import annotations

import logging

from app.core.phone import mask_email
from app.services.email.base import EmailProvider
from app.services.email.capture import capture_email

logger = logging.getLogger("alfa.email.console")


class ConsoleEmailProvider(EmailProvider):
    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        logger.warning(
            "EMAIL_PROVIDER=console: message for %s subject=%r (not a real SMTP send)",
            mask_email(to),
            subject,
        )
        capture_email(to=to, subject=subject, text_body=text_body)
