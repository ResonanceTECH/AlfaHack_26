from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import Field, field_validator

from app.core.enums import LegalForm
from app.schemas.common import APIModel


class RegistryLookupIn(APIModel):
    inn: str = Field(min_length=10, max_length=12)

    @field_validator("inn")
    @classmethod
    def inn_digits(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit():
            raise ValueError("ИНН должен содержать только цифры")
        if len(v) not in (10, 12):
            raise ValueError("ИНН: 10 цифр (ООО) или 12 (ИП)")
        return v


class RegistryCompanyOut(APIModel):
    inn: str
    legal_form: LegalForm
    name: str
    registration_date: date
    region: str
    registry_status: str = "ACTIVE"
    ogrn: str | None = None


class RegistryLookupOut(APIModel):
    found: bool
    source: str
    company: RegistryCompanyOut | None = None
    checked_at: datetime
    inn_valid: bool = True


class RegistryComparisonOut(APIModel):
    match: bool
    checks: dict[str, bool]
    mismatches: list[str]
    registry_status: str


class RegistryVerifyOut(APIModel):
    snapshot_id: str
    found: bool
    source: str
    company: RegistryCompanyOut | None = None
    comparison: RegistryComparisonOut | None = None
    registry_status: str | None = None
    checked_at: datetime


class RegistryHistoryItem(APIModel):
    id: str
    inn: str
    found: bool
    source: str
    registry_status: str | None = None
    checked_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)
