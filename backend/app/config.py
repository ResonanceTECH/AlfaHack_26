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

    app_name: str = "Линия решения API"
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

    ml_service_url: str = Field(default="", validation_alias="ML_SERVICE_URL")
    ml_service_enabled: bool = Field(default=False, validation_alias="ML_SERVICE_ENABLED")
    ml_service_timeout: float = Field(default=8.0, validation_alias="ML_SERVICE_TIMEOUT")

    llm_enabled: bool = False
    llm_base_url: str = "http://127.0.0.1:8081/v1"
    llm_main: str = "Qwen3-4B-Instruct-2507"
    llm_light: str = "Qwen3-4B-Instruct-2507"
    llm_timeout_seconds: float = Field(default=20, gt=0, le=120)
    llm_max_tokens: int = Field(default=900, ge=128, le=2048)
    llm_api_key: str = ""

    rate_limit_per_minute: int = 120

    demo_mode: bool = Field(default=True, validation_alias="DEMO_MODE")

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
