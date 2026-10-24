from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import uuid4

from fastapi import status as http_status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import PolicyStatus
from app.core.errors import AppError
from app.models.demo import DemoScenario
from app.models.policy import CreditPolicy, CreditPolicyVersion, PolicySimulation

ALLOWED_RULE_KEYS: dict[str, str] = {
    "max_debt_burden_ratio": "ratio",
    "min_business_age_months": "int",
    "min_avg_monthly_revenue": "money",
    "require_statement_months": "int",
    "max_loan_amount": "money",
    "min_loan_amount": "money",
    "min_employees": "int",
    "allowed_legal_forms": "str_list",
    "require_collateral_above": "money",
    "manual_review_debt_burden": "ratio",
    "reject_on_negative_cf_months": "int",
    "notes": "str",
}

SCENARIO_MOCK_OUTCOMES: dict[str, dict[str, Any]] = {
    "demo_approved": {
        "before": "APPROVED",
        "after": "APPROVED",
        "changed_rules": [],
    },
    "demo_counteroffer": {
        "before": "MANUAL_REVIEW",
        "after": "COUNTEROFFERED",
        "changed_rules": ["MAX_DEBT_BURDEN", "max_debt_burden_ratio"],
    },
    "demo_missing_docs": {
        "before": "DOCS_REQUESTED",
        "after": "DOCS_REQUESTED",
        "changed_rules": ["require_statement_months"],
    },
    "demo_rejected": {
        "before": "REJECTED",
        "after": "REJECTED",
        "changed_rules": ["max_debt_burden_ratio", "reject_on_negative_cf_months"],
    },
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_policy(policy: CreditPolicy, *, include_versions: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": policy.id,
        "code": policy.code,
        "name": policy.name,
        "description": policy.description,
        "status": policy.status,
        "version": policy.version,
        "rules": policy.rules or {},
        "parameter_source": "SYNTHETIC_DSL",
        "created_by": policy.created_by,
        "published_at": policy.published_at,
        "created_at": policy.created_at,
        "updated_at": policy.updated_at,
    }
    if include_versions:
        versions = sorted(policy.versions or [], key=lambda v: v.version, reverse=True)
        out["versions"] = [
            {
                "id": v.id,
                "policy_id": policy.id,
                "version": v.version,
                "rules": v.rules or {},
                "changelog": v.changelog,
                "created_by": v.created_by,
                "created_at": v.created_at,
            }
            for v in versions
        ]
    return out


def list_policies(
    db: Session,
    *,
    status: PolicyStatus | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(CreditPolicy)
    count_stmt = select(func.count(CreditPolicy.id))
    if status is not None:
        stmt = stmt.where(CreditPolicy.status == status)
        count_stmt = count_stmt.where(CreditPolicy.status == status)
    if q:
        like = f"%{q.strip()}%"
        filt = or_(CreditPolicy.name.ilike(like), CreditPolicy.code.ilike(like))
        stmt = stmt.where(filt)
        count_stmt = count_stmt.where(filt)
    total = db.scalar(count_stmt) or 0
    rows = list(
        db.scalars(
            stmt.order_by(CreditPolicy.updated_at.desc()).offset(offset).limit(min(limit, 100))
        ).all()
    )
    return [serialize_policy(p) for p in rows], int(total)


def get_policy(db: Session, policy_id: str) -> CreditPolicy | None:
    return db.scalar(
        select(CreditPolicy)
        .options(joinedload(CreditPolicy.versions), joinedload(CreditPolicy.simulations))
        .where(or_(CreditPolicy.id == policy_id, CreditPolicy.code == policy_id))
    )


def _ensure_unique_code(db: Session, code: str, *, exclude_id: str | None = None) -> None:
    q = select(CreditPolicy).where(CreditPolicy.code == code)
    if exclude_id:
        q = q.where(CreditPolicy.id != exclude_id)
    if db.scalar(q):
        raise AppError(
            "CODE_TAKEN",
            "Код политики уже занят",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "code", "code": "TAKEN"}],
        )


def _parse_money(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value).strip().replace(",", "."))
    except (InvalidOperation, ValueError, AttributeError):
        return None


def validate_rules(rules: dict[str, Any] | None) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    if rules is None:
        return {"valid": False, "errors": [{"field": "rules", "code": "REQUIRED", "message": "rules обязательны"}], "warnings": []}
    if not isinstance(rules, dict):
        return {
            "valid": False,
            "errors": [{"field": "rules", "code": "TYPE", "message": "rules должны быть JSON-объектом"}],
            "warnings": [],
        }
    if not rules:
        warnings.append({"field": "rules", "code": "EMPTY", "message": "Пустой набор правил"})

    for key, value in rules.items():
        if key not in ALLOWED_RULE_KEYS:
            errors.append(
                {
                    "field": f"rules.{key}",
                    "code": "UNKNOWN_KEY",
                    "message": f"Ключ '{key}' не в whitelist DSL",
                }
            )
            continue
        kind = ALLOWED_RULE_KEYS[key]
        if kind == "ratio":
            try:
                num = float(value)
            except (TypeError, ValueError):
                errors.append({"field": f"rules.{key}", "code": "TYPE", "message": "Ожидается число 0..1"})
                continue
            if not 0 <= num <= 1:
                errors.append({"field": f"rules.{key}", "code": "RANGE", "message": "Должно быть в [0, 1]"})
        elif kind == "int":
            if not isinstance(value, int) or isinstance(value, bool):
                try:
                    int(value)
                    warnings.append({"field": f"rules.{key}", "code": "COERCE", "message": "Приведётся к int"})
                except (TypeError, ValueError):
                    errors.append({"field": f"rules.{key}", "code": "TYPE", "message": "Ожидается целое"})
            elif int(value) < 0:
                errors.append({"field": f"rules.{key}", "code": "RANGE", "message": "Не может быть < 0"})
        elif kind == "money":
            amount = _parse_money(value)
            if amount is None:
                errors.append({"field": f"rules.{key}", "code": "TYPE", "message": "Ожидается денежная сумма"})
            elif amount < 0:
                errors.append({"field": f"rules.{key}", "code": "RANGE", "message": "Сумма не может быть < 0"})
        elif kind == "str_list":
            if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
                errors.append({"field": f"rules.{key}", "code": "TYPE", "message": "Ожидается list[str]"})
        elif kind == "str":
            if not isinstance(value, str):
                errors.append({"field": f"rules.{key}", "code": "TYPE", "message": "Ожидается строка"})

    if "min_loan_amount" in rules and "max_loan_amount" in rules:
        lo = _parse_money(rules["min_loan_amount"])
        hi = _parse_money(rules["max_loan_amount"])
        if lo is not None and hi is not None and hi < lo:
            errors.append(
                {
                    "field": "rules.max_loan_amount",
                    "code": "LT_MIN",
                    "message": "max_loan_amount < min_loan_amount",
                }
            )

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings, "allowed_keys": sorted(ALLOWED_RULE_KEYS)}


def create_policy(db: Session, data: dict[str, Any], *, actor_id: str | None) -> CreditPolicy:
    code = data["code"]
    _ensure_unique_code(db, code)
    rules = data.get("rules") or {}
    check = validate_rules(rules)
    if not check["valid"]:
        raise AppError(
            "VALIDATION_ERROR",
            "Правила политики не прошли валидацию",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": e["field"], "code": e["code"]} for e in check["errors"]],
        )

    policy = CreditPolicy(
        code=code,
        name=data["name"],
        description=data.get("description"),
        status=PolicyStatus.DRAFT,
        version=1,
        rules=rules,
        created_by=actor_id,
    )
    db.add(policy)
    db.flush()
    return policy


def patch_policy(db: Session, policy: CreditPolicy, patch: dict[str, Any]) -> CreditPolicy:
    if policy.status == PolicyStatus.ARCHIVED:
        raise AppError(
            "POLICY_ARCHIVED",
            "Архивную политику нельзя редактировать",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    if policy.status == PolicyStatus.PUBLISHED:
        policy.status = PolicyStatus.DRAFT

    if policy.status != PolicyStatus.DRAFT:
        raise AppError(
            "NOT_DRAFT",
            "Редактировать можно только черновик",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    if "code" in patch and patch["code"] is not None:
        _ensure_unique_code(db, patch["code"], exclude_id=policy.id)
        policy.code = patch["code"]
    for key in ("name", "description"):
        if key in patch and patch[key] is not None:
            setattr(policy, key, patch[key])
    if "rules" in patch and patch["rules"] is not None:
        check = validate_rules(patch["rules"])
        if not check["valid"]:
            raise AppError(
                "VALIDATION_ERROR",
                "Правила политики не прошли валидацию",
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                fields=[{"field": e["field"], "code": e["code"]} for e in check["errors"]],
            )
        policy.rules = patch["rules"]
    db.flush()
    return policy


def publish_policy(
    db: Session, policy: CreditPolicy, *, actor_id: str | None, changelog: str | None = None
) -> CreditPolicy:
    if policy.status == PolicyStatus.ARCHIVED:
        raise AppError(
            "POLICY_ARCHIVED",
            "Архивную политику нельзя опубликовать",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    if policy.status == PolicyStatus.PUBLISHED:
        raise AppError(
            "ALREADY_PUBLISHED",
            "Политика уже опубликована",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    check = validate_rules(policy.rules or {})
    if not check["valid"]:
        raise AppError(
            "VALIDATION_ERROR",
            "Политика не проходит валидацию для публикации",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": e["field"], "code": e["code"]} for e in check["errors"]],
        )

    existing = list(
        db.scalars(select(CreditPolicyVersion).where(CreditPolicyVersion.policy_id == policy.id)).all()
    )
    next_version = max((v.version for v in existing), default=0) + 1
    if policy.version and policy.version >= next_version and existing:
        next_version = policy.version + 1

    policy.status = PolicyStatus.PUBLISHED
    policy.version = next_version
    policy.published_at = utcnow()
    db.add(
        CreditPolicyVersion(
            policy_id=policy.id,
            version=next_version,
            rules=dict(policy.rules or {}),
            changelog=changelog or f"publish v{next_version}",
            created_by=actor_id,
        )
    )
    db.flush()
    return policy


def list_versions(db: Session, policy_id: str) -> list[dict[str, Any]]:
    policy = get_policy(db, policy_id)
    if policy is None:
        raise AppError("NOT_FOUND", "Политика не найдена", status_code=http_status.HTTP_404_NOT_FOUND)
    versions = sorted(policy.versions or [], key=lambda v: v.version, reverse=True)
    return [
        {
            "id": v.id,
            "policy_id": policy.id,
            "version": v.version,
            "rules": v.rules or {},
            "changelog": v.changelog,
            "created_by": v.created_by,
            "created_at": v.created_at,
        }
        for v in versions
    ]


def _parse_version_ref(raw: str | int) -> int:
    if isinstance(raw, int):
        return raw
    s = str(raw).strip().lower().lstrip("v")
    try:
        return int(s)
    except ValueError as exc:
        raise AppError(
            "INVALID_VERSION",
            f"Некорректная версия: {raw}",
            status_code=http_status.HTTP_400_BAD_REQUEST,
        ) from exc


def diff_versions(db: Session, policy_id: str, from_ref: str | int, to_ref: str | int) -> dict[str, Any]:
    policy = get_policy(db, policy_id)
    if policy is None:
        raise AppError("NOT_FOUND", "Политика не найдена", status_code=http_status.HTTP_404_NOT_FOUND)
    from_v = _parse_version_ref(from_ref)
    to_v = _parse_version_ref(to_ref)
    by_ver = {v.version: v for v in (policy.versions or [])}
    # draft working copy as "current" if requested version == policy.version and missing
    left = by_ver.get(from_v)
    right = by_ver.get(to_v)
    left_rules = (left.rules if left else None) or (policy.rules if from_v == policy.version else None)
    right_rules = (right.rules if right else None) or (policy.rules if to_v == policy.version else None)
    if left_rules is None or right_rules is None:
        raise AppError(
            "VERSION_NOT_FOUND",
            "Одна из версий не найдена",
            status_code=http_status.HTTP_404_NOT_FOUND,
        )

    keys = sorted(set(left_rules) | set(right_rules))
    added: dict[str, Any] = {}
    removed: dict[str, Any] = {}
    changed: dict[str, Any] = {}
    for k in keys:
        in_l = k in left_rules
        in_r = k in right_rules
        if in_l and not in_r:
            removed[k] = left_rules[k]
        elif in_r and not in_l:
            added[k] = right_rules[k]
        elif left_rules[k] != right_rules[k]:
            changed[k] = {"from": left_rules[k], "to": right_rules[k]}
    return {
        "policy_id": policy.id,
        "from_version": from_v,
        "to_version": to_v,
        "added": added,
        "removed": removed,
        "changed": changed,
    }


def start_simulation(
    db: Session,
    policy: CreditPolicy,
    *,
    actor_id: str | None,
    draft_version: int | None,
    scenario_ids: list[str] | None,
    compare_with_published: bool = True,
) -> PolicySimulation:
    scenarios = list(db.scalars(select(DemoScenario)).all())
    by_code = {s.code: s for s in scenarios}
    by_id = {s.id: s for s in scenarios}

    selected: list[DemoScenario] = []
    if scenario_ids:
        for sid in scenario_ids:
            sc = by_code.get(sid) or by_id.get(sid)
            if sc is None:
                raise AppError(
                    "SCENARIO_NOT_FOUND",
                    f"Сценарий не найден: {sid}",
                    status_code=http_status.HTTP_404_NOT_FOUND,
                )
            selected.append(sc)
    else:
        selected = scenarios[:4]

    draft_ver = draft_version or policy.version
    results = []
    for sc in selected:
        mock = SCENARIO_MOCK_OUTCOMES.get(
            sc.code,
            {
                "before": sc.seed_payload.get("expected_status", "IN_REVIEW"),
                "after": sc.seed_payload.get("expected_status", "IN_REVIEW"),
                "changed_rules": [],
            },
        )
        if compare_with_published and mock["before"] == mock["after"] and mock["changed_rules"]:
            pass
        results.append(
            {
                "scenario_id": sc.code,
                "scenario_title": sc.title,
                "before": mock["before"],
                "after": mock["after"],
                "changed_rules": mock["changed_rules"],
            }
        )

    run_id = f"sim_{uuid4().hex[:12]}"
    payload = {
        "draft_version": draft_ver,
        "scenario_ids": [s.code for s in selected],
        "compare_with_published": compare_with_published,
    }
    result = {
        "run_id": run_id,
        "status": "COMPLETED",
        "policy_draft_version": draft_ver,
        "policy_id": policy.id,
        "results": results,
        "is_mock": True,
        "note": "Детерминированный stub — правила не исполняются как код",
    }
    sim = PolicySimulation(
        id=run_id,
        policy_id=policy.id,
        policy_version_id=None,
        input_payload=payload,
        result=result,
        created_by=actor_id,
    )
    db.add(sim)
    db.flush()
    return sim


def get_simulation(db: Session, policy_id: str, run_id: str) -> dict[str, Any]:
    policy = get_policy(db, policy_id)
    if policy is None:
        raise AppError("NOT_FOUND", "Политика не найдена", status_code=http_status.HTTP_404_NOT_FOUND)
    sim = db.get(PolicySimulation, run_id)
    if sim is None or sim.policy_id != policy.id:
        raise AppError("NOT_FOUND", "Симуляция не найдена", status_code=http_status.HTTP_404_NOT_FOUND)
    out = dict(sim.result or {})
    out.setdefault("run_id", sim.id)
    out.setdefault("status", "COMPLETED")
    out["input"] = sim.input_payload or {}
    out["created_at"] = sim.created_at
    return out
