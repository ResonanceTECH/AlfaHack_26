from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import status as http_status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ProductStatus, ProductType
from app.core.errors import AppError
from app.models.credit import CreditProduct, CreditProductRule, CreditProductVersion


def _money_json(value: Decimal | int | float | str | None) -> str | None:
    if value is None:
        return None
    return f"{Decimal(str(value)):.2f}"


def product_snapshot(product: CreditProduct) -> dict[str, Any]:
    return {
        "id": product.id,
        "code": product.code,
        "name": product.name,
        "type": product.type.value if hasattr(product.type, "value") else str(product.type),
        "description": product.description,
        "amount_min": _money_json(product.amount_min),
        "amount_max": _money_json(product.amount_max),
        "term_min": product.term_min,
        "term_max": product.term_max,
        "rate_min": _money_json(product.rate_min),
        "rate_max": _money_json(product.rate_max),
        "currency": product.currency,
        "collateral_required": product.collateral_required,
        "legal_forms": product.legal_forms or [],
        "min_business_age_months": product.min_business_age_months,
        "suitable_goals": product.suitable_goals or [],
        "purpose_codes": product.suitable_goals or [],
        "documents": product.documents or [],
        "fees": product.fees or [],
        "schedule_types": product.schedule_types or [],
        "features": product.features or [],
        "eligibility_rules": product.eligibility_rules or {},
        "status": product.status.value if hasattr(product.status, "value") else str(product.status),
        "version": product.version,
        "is_active": product.is_active,
    }


def serialize_product(product: CreditProduct, *, include_versions: bool = False) -> dict[str, Any]:
    rules = [
        {
            "id": r.id,
            "rule_type": r.rule_type,
            "parameters": r.parameters or {},
            "version": r.version,
        }
        for r in (product.rules or [])
    ]
    out: dict[str, Any] = {
        "id": product.id,
        "code": product.code,
        "name": product.name,
        "type": product.type,
        "description": product.description,
        "amount_min": product.amount_min,
        "amount_max": product.amount_max,
        "term_min": product.term_min,
        "term_max": product.term_max,
        "term_min_months": product.term_min,
        "term_max_months": product.term_max,
        "rate_min": product.rate_min,
        "rate_max": product.rate_max,
        "annual_rate_percent": product.rate_min,
        "currency": product.currency or "RUB",
        "collateral_required": product.collateral_required,
        "legal_forms": product.legal_forms or [],
        "min_business_age_months": product.min_business_age_months,
        "suitable_goals": product.suitable_goals or [],
        "purpose_codes": product.suitable_goals or [],
        "documents": product.documents or [],
        "fees": product.fees or [],
        "schedule_types": product.schedule_types or [],
        "features": product.features or [],
        "eligibility_rules": product.eligibility_rules or {},
        "requirements": {
            "documents": product.documents or [],
            "min_business_age_months": product.min_business_age_months,
            "legal_forms": product.legal_forms or [],
            "eligibility_rules": product.eligibility_rules or {},
        },
        "rules": rules,
        "status": product.status,
        "version": product.version,
        "is_active": bool(product.is_active),
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }
    if include_versions:
        versions = sorted(product.versions or [], key=lambda v: v.version, reverse=True)
        out["versions"] = [
            {
                "id": v.id,
                "product_id": product.id,
                "version": v.version,
                "changelog": v.changelog,
                "created_by": v.created_by,
                "created_at": v.created_at,
                "snapshot": v.snapshot or {},
            }
            for v in versions
        ]
    return out


def list_products(
    db: Session,
    *,
    status: ProductStatus | None = None,
    product_type: ProductType | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(CreditProduct)
    count_stmt = select(func.count(CreditProduct.id))
    if status is not None:
        stmt = stmt.where(CreditProduct.status == status)
        count_stmt = count_stmt.where(CreditProduct.status == status)
    if product_type is not None:
        stmt = stmt.where(CreditProduct.type == product_type)
        count_stmt = count_stmt.where(CreditProduct.type == product_type)
    if q:
        like = f"%{q.strip()}%"
        filt = or_(CreditProduct.name.ilike(like), CreditProduct.code.ilike(like), CreditProduct.id.ilike(like))
        stmt = stmt.where(filt)
        count_stmt = count_stmt.where(filt)

    total = db.scalar(count_stmt) or 0
    rows = list(
        db.scalars(
            stmt.order_by(CreditProduct.updated_at.desc()).offset(offset).limit(min(limit, 100))
        ).all()
    )
    return [serialize_product(p) for p in rows], int(total)


def get_product(db: Session, product_id: str) -> CreditProduct | None:
    return db.scalar(
        select(CreditProduct)
        .options(joinedload(CreditProduct.rules), joinedload(CreditProduct.versions))
        .where(or_(CreditProduct.id == product_id, CreditProduct.code == product_id))
    )


def _ensure_unique_code(db: Session, code: str | None, *, exclude_id: str | None = None) -> None:
    if not code:
        return
    q = select(CreditProduct).where(or_(CreditProduct.code == code, CreditProduct.id == code))
    if exclude_id:
        q = q.where(CreditProduct.id != exclude_id)
    if db.scalar(q):
        raise AppError(
            "CODE_TAKEN",
            "Код продукта уже занят",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "code", "code": "TAKEN"}],
        )


def validate_product_fields(
    *,
    amount_min: Decimal,
    amount_max: Decimal,
    term_min: int,
    term_max: int,
    rate_min: Decimal,
    rate_max: Decimal,
) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    if amount_min <= 0:
        fields.append({"field": "amount_min", "code": "INVALID"})
    if amount_max < amount_min:
        fields.append({"field": "amount_max", "code": "LT_MIN"})
    if term_min < 1:
        fields.append({"field": "term_min", "code": "INVALID"})
    if term_max < term_min:
        fields.append({"field": "term_max", "code": "LT_MIN"})
    if rate_min < 0:
        fields.append({"field": "rate_min", "code": "INVALID"})
    if rate_max < rate_min:
        fields.append({"field": "rate_max", "code": "LT_MIN"})
    return fields


def create_product(db: Session, data: dict[str, Any], *, actor_id: str | None = None) -> CreditProduct:
    code = data.get("code")
    _ensure_unique_code(db, code)
    product_id = data.get("id") or code or None

    amount_min = data["amount_min"]
    amount_max = data["amount_max"]
    term_min = data.get("term_min_months") if data.get("term_min_months") is not None else data.get("term_min")
    term_max = data.get("term_max_months") if data.get("term_max_months") is not None else data.get("term_max")
    rate_min = data.get("annual_rate_percent") if data.get("annual_rate_percent") is not None else data.get("rate_min")
    rate_max = data.get("rate_max") if data.get("rate_max") is not None else rate_min
    suitable = data.get("purpose_codes") or data.get("suitable_goals") or []

    missing: list[dict[str, str]] = []
    if term_min is None:
        missing.append({"field": "term_min", "code": "REQUIRED"})
    if term_max is None:
        term_max = term_min
    if rate_min is None:
        missing.append({"field": "rate_min", "code": "REQUIRED"})
    if missing:
        raise AppError(
            "VALIDATION_ERROR",
            "Некорректные параметры продукта",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=missing,
        )

    fields = validate_product_fields(
        amount_min=amount_min,
        amount_max=amount_max,
        term_min=term_min,
        term_max=term_max,
        rate_min=rate_min,
        rate_max=rate_max,
    )
    if fields:
        raise AppError(
            "VALIDATION_ERROR",
            "Некорректные параметры продукта",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=fields,
        )

    kwargs: dict[str, Any] = {
        "code": code,
        "name": data["name"],
        "type": data["type"],
        "description": data.get("description") or "",
        "amount_min": amount_min,
        "amount_max": amount_max,
        "term_min": term_min,
        "term_max": term_max,
        "rate_min": rate_min,
        "rate_max": rate_max,
        "currency": data.get("currency") or "RUB",
        "collateral_required": bool(data.get("collateral_required", False)),
        "legal_forms": data.get("legal_forms") or [],
        "min_business_age_months": data.get("min_business_age_months") or 0,
        "suitable_goals": suitable,
        "documents": data.get("documents") or [],
        "fees": data.get("fees") or [],
        "schedule_types": data.get("schedule_types") or ["annuity"],
        "features": data.get("features") or [],
        "eligibility_rules": data.get("eligibility_rules") or {},
        "status": ProductStatus.DRAFT,
        "version": 1,
        "is_active": False,
    }
    if product_id:
        kwargs["id"] = product_id

    product = CreditProduct(**kwargs)
    db.add(product)
    db.flush()

    requirements = data.get("requirements") or {}
    rule_params = {
        "min_age_months": product.min_business_age_months,
        "legal_forms": product.legal_forms,
        "goals": product.suitable_goals,
        **(requirements if isinstance(requirements, dict) else {}),
    }
    db.add(
        CreditProductRule(
            product_id=product.id,
            rule_type="eligibility",
            parameters=rule_params,
            version="demo-rules-v1",
        )
    )
    db.flush()
    _ = actor_id
    return product


def patch_product(db: Session, product: CreditProduct, patch: dict[str, Any]) -> CreditProduct:
    if product.status == ProductStatus.ARCHIVED:
        raise AppError(
            "PRODUCT_ARCHIVED",
            "Архивный продукт нельзя редактировать",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    # Редактирование опубликованного → снова черновик (каталог до re-publish не видит)
    if product.status == ProductStatus.PUBLISHED:
        product.status = ProductStatus.DRAFT
        product.is_active = False

    if product.status != ProductStatus.DRAFT:
        raise AppError(
            "NOT_DRAFT",
            "Редактировать можно только черновик",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    alias_map = {
        "term_min_months": "term_min",
        "term_max_months": "term_max",
        "annual_rate_percent": "rate_min",
        "purpose_codes": "suitable_goals",
    }
    normalized = dict(patch)
    for src, dst in alias_map.items():
        if src in normalized and dst not in normalized:
            normalized[dst] = normalized.pop(src)
        elif src in normalized:
            normalized.pop(src)

    if "code" in normalized:
        _ensure_unique_code(db, normalized.get("code"), exclude_id=product.id)

    for key in (
        "code",
        "name",
        "type",
        "description",
        "amount_min",
        "amount_max",
        "term_min",
        "term_max",
        "rate_min",
        "rate_max",
        "currency",
        "collateral_required",
        "legal_forms",
        "min_business_age_months",
        "suitable_goals",
        "documents",
        "fees",
        "schedule_types",
        "features",
        "eligibility_rules",
    ):
        if key in normalized and normalized[key] is not None:
            setattr(product, key, normalized[key])

    if "annual_rate_percent" in patch and "rate_max" not in normalized and "rate_max" not in patch:
        product.rate_max = product.rate_min

    fields = validate_product_fields(
        amount_min=product.amount_min,
        amount_max=product.amount_max,
        term_min=product.term_min,
        term_max=product.term_max,
        rate_min=product.rate_min,
        rate_max=product.rate_max,
    )
    if fields:
        raise AppError(
            "VALIDATION_ERROR",
            "Некорректные параметры продукта",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=fields,
        )
    db.flush()
    return product


def publish_product(
    db: Session, product: CreditProduct, *, actor_id: str | None, changelog: str | None = None
) -> CreditProduct:
    if product.status == ProductStatus.ARCHIVED:
        raise AppError(
            "PRODUCT_ARCHIVED",
            "Архивный продукт нельзя опубликовать",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    if product.status == ProductStatus.PUBLISHED and product.is_active:
        raise AppError(
            "ALREADY_PUBLISHED",
            "Продукт уже опубликован",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    fields = validate_product_fields(
        amount_min=product.amount_min,
        amount_max=product.amount_max,
        term_min=product.term_min,
        term_max=product.term_max,
        rate_min=product.rate_min,
        rate_max=product.rate_max,
    )
    if not product.name:
        fields.append({"field": "name", "code": "REQUIRED"})
    if fields:
        raise AppError(
            "VALIDATION_ERROR",
            "Продукт не проходит валидацию для публикации",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=fields,
        )

    existing_versions = list(
        db.scalars(
            select(CreditProductVersion).where(CreditProductVersion.product_id == product.id)
        ).all()
    )
    next_version = max((v.version for v in existing_versions), default=0) + 1
    if product.version and product.version >= next_version and existing_versions:
        next_version = product.version + 1

    product.status = ProductStatus.PUBLISHED
    product.is_active = True
    product.version = next_version
    db.add(
        CreditProductVersion(
            product_id=product.id,
            version=next_version,
            snapshot=product_snapshot(product),
            changelog=changelog or f"publish v{next_version}",
            created_by=actor_id,
        )
    )
    db.flush()
    return product


def archive_product(db: Session, product: CreditProduct) -> CreditProduct:
    if product.status == ProductStatus.ARCHIVED:
        raise AppError(
            "ALREADY_ARCHIVED",
            "Продукт уже в архиве",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    if product.status == ProductStatus.DRAFT:
        raise AppError(
            "DRAFT_ARCHIVE",
            "Черновик нельзя архивировать — удалите или опубликуйте",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    product.status = ProductStatus.ARCHIVED
    product.is_active = False
    db.flush()
    return product


def list_versions(db: Session, product_id: str) -> list[dict[str, Any]]:
    product = get_product(db, product_id)
    if product is None:
        raise AppError("NOT_FOUND", "Продукт не найден", status_code=http_status.HTTP_404_NOT_FOUND)
    versions = sorted(product.versions or [], key=lambda v: v.version, reverse=True)
    return [
        {
            "id": v.id,
            "product_id": product.id,
            "version": v.version,
            "changelog": v.changelog,
            "created_by": v.created_by,
            "created_at": v.created_at,
            "snapshot": v.snapshot or {},
        }
        for v in versions
    ]
