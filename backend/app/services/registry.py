from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.enums import LegalForm
from app.core.inn import inn10_checksum, inn12_checksum, is_valid_inn
from app.models.company import Company, RegistrySnapshot

SOURCE = "SYNTHETIC_REGISTRY"

# Демо-ИНН (валидные КС) — совпадают с seed
INN_IP = inn12_checksum("7701234567")
INN_OOO = inn10_checksum("770987654")
INN_COFFEE = inn10_checksum("770123456")


@dataclass(frozen=True)
class RegistryCompany:
    inn: str
    legal_form: LegalForm
    name: str
    registration_date: date
    region: str
    registry_status: str = "ACTIVE"
    ogrn: str | None = None
    industry: str | None = None

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "inn": self.inn,
            "legal_form": self.legal_form.value,
            "name": self.name,
            "registration_date": self.registration_date.isoformat(),
            "region": self.region,
            "registry_status": self.registry_status,
        }


def _catalog() -> dict[str, RegistryCompany]:
    return {
        INN_IP: RegistryCompany(
            inn=INN_IP,
            legal_form=LegalForm.IP,
            name="ИП Петров Иван Сергеевич",
            registration_date=date(2019, 3, 15),
            region="Москва",
            registry_status="ACTIVE",
            ogrn="304770100012345",
            industry="Розничная торговля",
        ),
        INN_OOO: RegistryCompany(
            inn=INN_OOO,
            legal_form=LegalForm.OOO,
            name="ООО Секретные Данные",
            registration_date=date(2018, 1, 10),
            region="Санкт-Петербург",
            registry_status="ACTIVE",
            ogrn="1027700000123",
            industry="Оптовая торговля",
        ),
        INN_COFFEE: RegistryCompany(
            inn=INN_COFFEE,
            legal_form=LegalForm.OOO,
            name="ООО «Кофе Плюс»",
            registration_date=date(2021, 4, 15),
            region="Москва",
            registry_status="ACTIVE",
            ogrn="1217700123456",
            industry="Общественное питание",
        ),
        inn10_checksum("500100732"): RegistryCompany(
            inn=inn10_checksum("500100732"),
            legal_form=LegalForm.OOO,
            name="ООО «Ликвидированный Пример»",
            registration_date=date(2015, 6, 1),
            region="Московская область",
            registry_status="LIQUIDATED",
            industry="Услуги",
        ),
    }


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def lookup(inn: str) -> dict[str, Any]:
    inn = (inn or "").strip()
    checked_at = utcnow()
    if not is_valid_inn(inn):
        return {
            "found": False,
            "source": SOURCE,
            "company": None,
            "checked_at": checked_at,
            "inn_valid": False,
        }

    entry = _catalog().get(inn)
    if entry is None:
        return {
            "found": False,
            "source": SOURCE,
            "company": None,
            "checked_at": checked_at,
            "inn_valid": True,
        }

    return {
        "found": True,
        "source": SOURCE,
        "company": entry.to_public_dict(),
        "checked_at": checked_at,
        "inn_valid": True,
    }


def _compare(company: Company, entry: RegistryCompany) -> dict[str, Any]:
    checks = {
        "inn": company.inn == entry.inn,
        "legal_form": company.legal_form == entry.legal_form,
        "name": company.name.strip().casefold() == entry.name.strip().casefold(),
        "registration_date": company.registration_date == entry.registration_date,
        "region": company.region.strip().casefold() == entry.region.strip().casefold(),
    }
    mismatches = [k for k, ok in checks.items() if not ok]
    match = not mismatches and entry.registry_status == "ACTIVE"
    return {
        "match": match,
        "checks": checks,
        "mismatches": mismatches,
        "registry_status": entry.registry_status,
    }


def verify_company(db: Session, company: Company) -> tuple[RegistrySnapshot, dict[str, Any]]:
    checked_at = utcnow()
    result = lookup(company.inn)
    entry = _catalog().get(company.inn)

    comparison: dict[str, Any] | None = None
    if entry is not None:
        comparison = _compare(company, entry)
        company.registry_status = entry.registry_status

    payload: dict[str, Any] = {
        "lookup": {
            "found": result["found"],
            "inn_valid": result.get("inn_valid", True),
            "company": result.get("company"),
        },
        "comparison": comparison,
        "company_snapshot": {
            "id": company.id,
            "inn": company.inn,
            "name": company.name,
            "legal_form": company.legal_form.value,
            "registration_date": company.registration_date.isoformat(),
            "region": company.region,
        },
    }

    snap = RegistrySnapshot(
        company_id=company.id,
        inn=company.inn,
        source=SOURCE,
        found=bool(result["found"]),
        registry_status=entry.registry_status if entry else None,
        payload=payload,
        checked_at=checked_at,
    )
    db.add(snap)
    db.flush()
    return snap, {
        "snapshot_id": snap.id,
        "found": snap.found,
        "source": SOURCE,
        "company": result.get("company"),
        "comparison": comparison,
        "registry_status": snap.registry_status,
        "checked_at": checked_at,
    }
