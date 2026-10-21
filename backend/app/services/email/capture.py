from __future__ import annotations

from threading import Lock

_lock = Lock()
_last: list[dict[str, str]] = []


def capture_email(*, to: str, subject: str, text_body: str) -> None:
    with _lock:
        _last.append({"to": to, "subject": subject, "text": text_body})


def get_captured_emails() -> list[dict[str, str]]:
    with _lock:
        return list(_last)


def clear_captured_emails() -> None:
    with _lock:
        _last.clear()


def last_email_to(to: str) -> dict[str, str] | None:
    with _lock:
        for item in reversed(_last):
            if item["to"].lower() == to.lower():
                return item
    return None
