from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError
from app.models.ml_registry import MlModelRegistry, ModelActivation, ModelEvaluation

RUNTIME_DEFAULTS: dict[str, Any] = {
    "assistant_enabled": True,
    "assistant_max_tokens": 512,
    "ranker_fallback_rules": True,
    "llm_timeout_ms": 3000,
    "max_context_messages": 20,
    "enable_model_telemetry": True,
}
RUNTIME_WHITELIST = frozenset(RUNTIME_DEFAULTS)
_runtime_state: dict[str, Any] = deepcopy(RUNTIME_DEFAULTS)

KNOWN_TASKS = frozenset({"RANK_PRODUCTS", "AI_ASSISTANT", "DOC_EXTRACT", "RISK_SCORE"})


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_model(model: MlModelRegistry, *, include_evals: bool = False) -> dict[str, Any]:
    meta = model.meta or {}
    active = any(a.is_active for a in (model.activations or []))
    out: dict[str, Any] = {
        "id": model.id,
        "name": model.name,
        "version": model.version,
        "task": model.task,
        "status": model.status,
        "endpoint": model.endpoint,
        "metrics": model.metrics or {},
        "input_schema": meta.get("input_schema") or {},
        "output_schema": meta.get("output_schema") or {},
        "artifact": meta.get("artifact"),
        "resources": meta.get("resources") or {},
        "fallback": meta.get("fallback"),
        "params_billion": meta.get("params_billion"),
        "is_active": active,
        "meta": meta,
        "created_at": model.created_at,
        "updated_at": model.updated_at,
    }
    if include_evals:
        out["evaluations"] = [
            serialize_evaluation(e) for e in sorted(model.evaluations or [], key=lambda x: x.created_at, reverse=True)
        ]
    return out


def serialize_evaluation(ev: ModelEvaluation) -> dict[str, Any]:
    return {
        "id": ev.id,
        "model_id": ev.model_id,
        "dataset": ev.dataset,
        "metrics": ev.metrics or {},
        "notes": ev.notes,
        "created_by": ev.created_by,
        "created_at": ev.created_at,
    }


def list_models(db: Session, *, task: str | None = None) -> list[dict[str, Any]]:
    stmt = select(MlModelRegistry).options(joinedload(MlModelRegistry.activations))
    if task:
        stmt = stmt.where(MlModelRegistry.task == task)
    rows = list(db.scalars(stmt.order_by(MlModelRegistry.task, MlModelRegistry.name, MlModelRegistry.version)).unique().all())
    return [serialize_model(m) for m in rows]


def get_model(db: Session, model_id: str) -> MlModelRegistry | None:
    return db.scalar(
        select(MlModelRegistry)
        .options(joinedload(MlModelRegistry.activations), joinedload(MlModelRegistry.evaluations))
        .where(MlModelRegistry.id == model_id)
    )


def list_active(db: Session) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(ModelActivation)
            .options(joinedload(ModelActivation.model))
            .where(ModelActivation.is_active.is_(True))
            .order_by(ModelActivation.task)
        )
        .unique()
        .all()
    )
    out: list[dict[str, Any]] = []
    for act in rows:
        m = act.model
        out.append(
            {
                "task": act.task,
                "model_id": act.model_id,
                "name": m.name if m else None,
                "version": m.version if m else None,
                "status": "ACTIVE",
                "activated_by": act.activated_by,
                "activated_at": act.activated_at,
                "fallback": (m.meta or {}).get("fallback") if m else None,
            }
        )
    return out


def mock_health_check(model: MlModelRegistry) -> dict[str, Any]:
    meta = model.meta or {}
    artifact = meta.get("artifact")
    force_fail = bool(meta.get("force_health_fail"))
    ram = (meta.get("resources") or {}).get("ram_mb", 0)
    ok = bool(artifact) and not force_fail and ram <= 8192
    return {
        "healthy": ok,
        "artifact_available": bool(artifact) and not force_fail,
        "artifact": artifact,
        "resources_ok": ram <= 8192,
        "device": (meta.get("resources") or {}).get("device", "cpu"),
        "checked_at": utcnow().isoformat(),
        "is_mock": True,
        "message": "OK" if ok else "Health-check failed (mock)",
    }


def validate_model(db: Session, model: MlModelRegistry) -> dict[str, Any]:
    _ = db
    meta = model.meta or {}
    health = mock_health_check(model)
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    if model.task not in KNOWN_TASKS:
        warnings.append({"field": "task", "code": "UNKNOWN_TASK", "message": f"Неизвестная задача: {model.task}"})
    if not meta.get("input_schema"):
        warnings.append({"field": "input_schema", "code": "MISSING", "message": "Нет описания входа"})
    if not meta.get("output_schema"):
        warnings.append({"field": "output_schema", "code": "MISSING", "message": "Нет описания выхода"})
    if not health["artifact_available"]:
        errors.append({"field": "artifact", "code": "UNAVAILABLE", "message": "Артефакт недоступен"})
    if not health["resources_ok"]:
        errors.append({"field": "resources", "code": "TOO_LARGE", "message": "Требования к RAM превышают лимит демо"})
    params = meta.get("params_billion")
    if params is not None and float(params) > 120:
        errors.append({"field": "params_billion", "code": "LIMIT", "message": "Превышен лимит 120B параметров"})
    elif params is not None and float(params) > 7:
        warnings.append({"field": "params_billion", "code": "LARGE", "message": "Для CPU лучше меньшая модель"})

    compatible = len(errors) == 0 and health["healthy"]
    return {
        "model_id": model.id,
        "compatible": compatible,
        "health": health,
        "errors": errors,
        "warnings": warnings,
        "contract": {
            "input_schema": meta.get("input_schema") or {},
            "output_schema": meta.get("output_schema") or {},
            "fallback": meta.get("fallback"),
        },
    }


def activate_model(
    db: Session,
    model: MlModelRegistry,
    *,
    task: str,
    expected_model_version: str | None,
    reason: str | None,
    actor_id: str | None,
) -> dict[str, Any]:
    if task != model.task:
        raise AppError(
            "TASK_MISMATCH",
            f"Модель предназначена для {model.task}, запрошено {task}",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "task", "code": "MISMATCH"}],
        )
    if expected_model_version and expected_model_version != model.version:
        raise AppError(
            "VERSION_MISMATCH",
            f"Ожидалась версия {expected_model_version}, у модели {model.version}",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "expected_model_version", "code": "MISMATCH"}],
        )

    check = validate_model(db, model)
    if not check["compatible"]:
        return {
            "model_id": model.id,
            "task": task,
            "status": "FAILED",
            "reason": reason,
            "validation": check,
            "activated_at": None,
        }

    # deactivate others on this task
    others = list(
        db.scalars(
            select(ModelActivation).where(
                ModelActivation.task == task,
                ModelActivation.is_active.is_(True),
            )
        ).all()
    )
    now = utcnow()
    for act in others:
        act.is_active = False
        act.deactivated_at = now
        prev = db.get(MlModelRegistry, act.model_id)
        if prev and prev.id != model.id and prev.status == "ACTIVE":
            prev.status = "REGISTERED"

    existing = db.scalar(
        select(ModelActivation).where(
            ModelActivation.model_id == model.id,
            ModelActivation.task == task,
        )
    )
    if existing:
        existing.is_active = True
        existing.activated_by = actor_id
        existing.activated_at = now
        existing.deactivated_at = None
        existing.meta = {**(existing.meta or {}), "reason": reason}
        activation = existing
    else:
        activation = ModelActivation(
            model_id=model.id,
            task=task,
            is_active=True,
            activated_by=actor_id,
            activated_at=now,
            meta={"reason": reason},
        )
        db.add(activation)

    model.status = "ACTIVE"
    db.flush()
    return {
        "model_id": model.id,
        "task": task,
        "status": "ACTIVE",
        "version": model.version,
        "reason": reason,
        "activation_id": activation.id,
        "activated_at": activation.activated_at,
        "activated_by": actor_id,
        "validation": check,
    }


def list_evaluations(db: Session, *, model_id: str | None = None) -> list[dict[str, Any]]:
    stmt = select(ModelEvaluation).options(joinedload(ModelEvaluation.model))
    if model_id:
        stmt = stmt.where(ModelEvaluation.model_id == model_id)
    rows = list(db.scalars(stmt.order_by(ModelEvaluation.created_at.desc())).unique().all())
    out = []
    for ev in rows:
        item = serialize_evaluation(ev)
        if ev.model:
            item["model_name"] = ev.model.name
            item["model_version"] = ev.model.version
            item["task"] = ev.model.task
            item["baseline"] = (ev.metrics or {}).get("baseline_ndcg")
        out.append(item)
    return out


def get_runtime_config() -> dict[str, Any]:
    return {
        "parameters": deepcopy(_runtime_state),
        "whitelist": sorted(RUNTIME_WHITELIST),
        "note": "Только не-секретные параметры; секреты через env",
    }


def patch_runtime_config(patch: dict[str, Any]) -> dict[str, Any]:
    rejected: list[str] = []
    applied: dict[str, Any] = {}
    for key, value in patch.items():
        if key not in RUNTIME_WHITELIST:
            rejected.append(key)
            continue
        expected = type(RUNTIME_DEFAULTS[key])
        if expected is bool and not isinstance(value, bool):
            raise AppError(
                "TYPE_ERROR",
                f"{key}: ожидается bool",
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                fields=[{"field": key, "code": "TYPE"}],
            )
        if expected is int and not isinstance(value, int):
            raise AppError(
                "TYPE_ERROR",
                f"{key}: ожидается int",
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                fields=[{"field": key, "code": "TYPE"}],
            )
        _runtime_state[key] = value
        applied[key] = value
    if rejected and not applied:
        raise AppError(
            "NOT_WHITELISTED",
            "Нет разрешённых параметров для изменения",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": k, "code": "FORBIDDEN"} for k in rejected],
        )
    result = get_runtime_config()
    result["applied"] = applied
    result["rejected"] = rejected
    return result
