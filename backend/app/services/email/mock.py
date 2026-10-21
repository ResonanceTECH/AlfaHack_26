from __future__ import annotations

from app.services.email.base import EmailDeliveryError, EmailProvider
from app.services.email.capture import capture_email


class MockEmailProvider(EmailProvider):
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.sent: list[dict[str, str]] = []

    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        if self.fail:
            raise EmailDeliveryError("Email provider unavailable (mock failure)")
        item = {"to": to, "subject": subject, "text": text_body}
        self.sent.append(item)
        capture_email(to=to, subject=subject, text_body=text_body)
