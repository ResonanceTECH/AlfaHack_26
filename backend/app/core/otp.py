from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Final

from app.config import get_settings

OTP_LENGTH: Final[int] = 6
TOKEN_BYTES: Final[int] = 32


def generate_otp_code() -> str:
    return f"{secrets.randbelow(10**OTP_LENGTH):0{OTP_LENGTH}d}"


def generate_url_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_secret(value: str) -> str:
    settings = get_settings()
    key = settings.jwt_secret_key.encode("utf-8")
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_secret(value: str, value_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(value), value_hash)


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
