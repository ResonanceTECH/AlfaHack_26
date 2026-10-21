from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "Alfa Business Credit API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    auth_access_token_ttl: int | None = Field(default=None, validation_alias="AUTH_ACCESS_TOKEN_TTL")
    auth_refresh_token_ttl: int | None = Field(default=None, validation_alias="AUTH_REFRESH_TOKEN_TTL")

    redis_url: str = "redis://localhost:6379/0"

    upload_dir: str = "./uploads"
    max_upload_mb: int = 15

    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="CORS_ORIGINS",
    )

    frontend_url: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_URL")
    backend_url: str = Field(default="http://localhost:8000", validation_alias="BACKEND_URL")

    sms_provider: str = Field(default="console", validation_alias="SMS_PROVIDER")
    sms_api_key: str = Field(default="", validation_alias="SMS_API_KEY")
    sms_sender: str = Field(default="AlfaCredit", validation_alias="SMS_SENDER")

    email_provider: str = Field(default="console", validation_alias="EMAIL_PROVIDER")
    smtp_host: str = Field(default="", validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, validation_alias="SMTP_PORT")
    smtp_username: str = Field(default="", validation_alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", validation_alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="", validation_alias="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(default=True, validation_alias="SMTP_USE_TLS")

    otp_ttl_seconds: int = 300
    otp_resend_seconds: int = 60
    otp_max_attempts: int = 5
    email_token_ttl_seconds: int = 86400

    ml_service_url: str = Field(default="", validation_alias="ML_SERVICE_URL")
    ml_service_enabled: bool = Field(default=False, validation_alias="ML_SERVICE_ENABLED")
    ml_service_timeout: float = Field(default=8.0, validation_alias="ML_SERVICE_TIMEOUT")

    rate_limit_per_minute: int = 120

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")

    @property
    def access_ttl_minutes(self) -> int:
        if self.auth_access_token_ttl is not None:
            return max(1, self.auth_access_token_ttl // 60)
        return self.access_token_expire_minutes

    @property
    def refresh_ttl_days(self) -> int:
        if self.auth_refresh_token_ttl is not None:
            return max(1, self.auth_refresh_token_ttl // 86400)
        return self.refresh_token_expire_days

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> List[str]:
        return [x.strip() for x in self.cors_origins_raw.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
