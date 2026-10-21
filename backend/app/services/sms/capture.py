from __future__ import annotations

from threading import Lock

_lock = Lock()
_last: dict[str, str] = {}


def capture_sms(phone: str, code: str) -> None:
    with _lock:
        _last[phone] = code


def get_captured_sms(phone: str) -> str | None:
    with _lock:
        return _last.get(phone)


def clear_captured_sms() -> None:
    with _lock:
        _last.clear()
