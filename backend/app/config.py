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

    redis_url: str = "redis://localhost:6379/0"

    upload_dir: str = "./uploads"
    max_upload_mb: int = 15

    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="CORS_ORIGINS",
    )

    rate_limit_per_minute: int = 120

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        return [x.strip() for x in self.cors_origins_raw.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
