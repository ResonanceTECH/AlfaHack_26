from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import status as http_status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.errors import AppError
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.demo import DemoJob, DemoScenario
from app.models.user import User

RESET_CONFIRM_PHRASE = "RESET_DEMO_DATA"
ALLOWED_WORKSPACE = "demo"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _seed_module():
    from scripts import seed as seed_mod

    return seed_mod


def seed_version() -> str:
    return _seed_module().SEED_VERSION


def assert_demo_ops_allowed(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if settings.is_production:
        raise AppError(
            "DEMO_FORBIDDEN",
            "Demo reset/load запрещены в production",
            status_code=http_status.HTTP_403_FORBIDDEN,
        )
    if not settings.demo_mode:
        raise AppError(
            "DEMO_MODE_OFF",
            "DEMO_MODE=false — операции демо-среды отключены",
            status_code=http_status.HTTP_403_FORBIDDEN,
        )
    url = (settings.database_url or "").lower()
    # мягкая защита от явного prod DSN при включённом DEMO_MODE
    blocked_markers = ("prod-db", "production.", "rds.amazonaws.com/prod")
    if any(m in url for m in blocked_markers):
        raise AppError(
            "DEMO_FORBIDDEN",
            "Подозрение на production database — операция отклонена",
            status_code=http_status.HTTP_403_FORBIDDEN,
        )


def serialize_scenario(sc: DemoScenario) -> dict[str, Any]:
    payload = sc.seed_payload or {}
    return {
        "id": sc.id,
        "code": sc.code,
        "title": sc.title,
        "description": sc.description,
        "persona": sc.persona,
        "seed_version": payload.get("seed_version") or seed_version(),
        "seed_payload": payload,
        "company_id": payload.get("company_id"),
        "application_id": payload.get("application_id"),
        "expected_status": payload.get("expected_status"),
        "expected_decision": payload.get("expected_decision"),
        "expected_offer_id": payload.get("expected_offer_id"),
        "created_at": sc.created_at,
    }


def list_scenarios(db: Session) -> list[dict[str, Any]]:
    rows = list(db.scalars(select(DemoScenario).order_by(DemoScenario.code)).all())
    return [serialize_scenario(s) for s in rows]


def get_scenario(db: Session, scenario_id: str) -> DemoScenario | None:
    return db.scalar(
        select(DemoScenario).where(
            or_(DemoScenario.id == scenario_id, DemoScenario.code == scenario_id)
        )
    )


def serialize_job(job: DemoJob) -> dict[str, Any]:
    return {
        "id": job.id,
        "job_id": job.id,
        "scenario_id": job.scenario_id,
        "job_type": job.job_type,
        "status": job.status,
        "requested_by": job.requested_by,
        "result": job.result or {},
        "error_message": job.error_message,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "created_at": job.created_at,
    }


def get_job(db: Session, job_id: str) -> DemoJob | None:
    return db.get(DemoJob, job_id)


def _check_scenario_entities(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("company_id")
    application_id = payload.get("application_id")
    company_ok = bool(company_id and db.get(Company, company_id))
    app = db.get(CreditApplication, application_id) if application_id else None
    app_ok = app is not None
    status_match = None
    if app is not None and payload.get("expected_status"):
        status_match = app.status.value == payload["expected_status"]
    return {
        "company_ok": company_ok,
        "application_ok": app_ok,
        "status_match": status_match,
        "actual_status": app.status.value if app else None,
    }


def load_scenario(
    db: Session,
    scenario: DemoScenario,
    *,
    actor_id: str | None,
) -> DemoJob:
    assert_demo_ops_allowed()
    now = utcnow()
    job_id = f"demo_job_{uuid4().hex[:12]}"
    payload = scenario.seed_payload or {}
    checks = _check_scenario_entities(db, payload)

    status = "COMPLETED" if checks["company_ok"] and checks["application_ok"] else "FAILED"
    result = {
        "scenario_id": scenario.id,
        "scenario_code": scenario.code,
        "seed_version": payload.get("seed_version") or seed_version(),
        "workspace": ALLOWED_WORKSPACE,
        "entities": checks,
        "pointers": {
            "company_id": payload.get("company_id"),
            "application_id": payload.get("application_id"),
            "expected_offer_id": payload.get("expected_offer_id"),
            "document_request_id": payload.get("document_request_id"),
        },
        "logins": {
            "entrepreneur_ip": "ip@demo.alfa",
            "entrepreneur_ooo": "ooo@demo.alfa",
            "analyst": "analyst@demo.alfa",
            "admin": "admin@demo.alfa",
            "password": "demo1234",
        },
        "is_mock": False,
        "note": (
            "Сценарий доступен в текущем seed"
            if status == "COMPLETED"
            else "Сущности сценария отсутствуют — выполните POST /admin/demo/reset"
        ),
    }
    job = DemoJob(
        id=job_id,
        scenario_id=scenario.id,
        job_type="LOAD_SCENARIO",
        status=status,
        requested_by=actor_id,
        result=result,
        error_message=None if status == "COMPLETED" else result["note"],
        started_at=now,
        finished_at=now,
    )
    db.add(job)
    db.flush()
    return job


def reset_demo(
    db: Session,
    *,
    actor_id: str | None,
    workspace: str,
    confirm_phrase: str,
    requested_seed_version: str | None,
) -> DemoJob:
    assert_demo_ops_allowed()
    if workspace != ALLOWED_WORKSPACE:
        raise AppError(
            "INVALID_WORKSPACE",
            f"Разрешён только workspace='{ALLOWED_WORKSPACE}'",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": "workspace", "code": "INVALID"}],
        )
    if confirm_phrase != RESET_CONFIRM_PHRASE:
        raise AppError(
            "CONFIRM_REQUIRED",
            f"Нужна фраза подтверждения {RESET_CONFIRM_PHRASE}",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": "confirm_phrase", "code": "MISMATCH"}],
        )

    seed_mod = _seed_module()
    current = seed_mod.SEED_VERSION
    if requested_seed_version and requested_seed_version != current:
        raise AppError(
            "SEED_VERSION_MISMATCH",
            f"Ожидается seed_version={current}",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "seed_version", "code": "MISMATCH"}],
        )

    running = db.scalar(
        select(DemoJob).where(
            DemoJob.job_type == "RESET",
            DemoJob.status.in_(("PENDING", "RUNNING")),
        )
    )
    if running:
        raise AppError(
            "RESET_IN_PROGRESS",
            "Сброс уже выполняется",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    job_id = f"demo_job_{uuid4().hex[:12]}"
    now = utcnow()
    actor_login = None
    if actor_id:
        actor = db.get(User, actor_id)
        actor_login = actor.login if actor else None

    try:
        seed_mod.wipe_all_tables(db)
        seed_mod.populate(db, now=now)
        # wipe удалил и jobs — создаём запись результата после seed
        job = DemoJob(
            id=job_id,
            scenario_id=None,
            job_type="RESET",
            status="COMPLETED",
            requested_by=actor_id,
            result={
                "workspace": ALLOWED_WORKSPACE,
                "seed_version": current,
                "confirm_phrase_ok": True,
                "sessions_revoked": True,
                "note": "Демосреда пересоздана; нужна повторная аутентификация",
                "actor_login": actor_login,
                "accounts": [
                    "ip@demo.alfa",
                    "ooo@demo.alfa",
                    "analyst@demo.alfa",
                    "admin@demo.alfa",
                ],
            },
            started_at=now,
            finished_at=utcnow(),
        )
        db.add(job)
        db.flush()
        return job
    except Exception as exc:
        # попытка зафиксировать FAILED job если таблицы ещё живы
        try:
            db.rollback()
            job = DemoJob(
                id=job_id,
                job_type="RESET",
                status="FAILED",
                requested_by=actor_id,
                result={"workspace": ALLOWED_WORKSPACE},
                error_message=str(exc)[:1000],
                started_at=now,
                finished_at=utcnow(),
            )
            db.add(job)
            db.flush()
        except Exception:
            pass
        raise AppError(
            "RESET_FAILED",
            f"Сброс демосреды не удался: {exc}",
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc
