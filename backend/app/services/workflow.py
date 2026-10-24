from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import (
    STATUS_TRANSITIONS,
    ApplicationStatus,
    CheckAudience,
    WorkflowStatus,
)
from app.core.errors import AppError
from app.models.application import (
    ApplicationCheck,
    ApplicationStatusHistory,
    ApplicationWorkflow,
    CreditApplication,
)
from app.models.company import Company
from app.models.finance import FinancialSnapshot
from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


STEP_BY_STATUS: dict[ApplicationStatus, str] = {
    ApplicationStatus.DRAFT: "CREDIT_PARAMETERS",
    ApplicationStatus.SUBMITTED: "AUTOMATED_VALIDATION",
    ApplicationStatus.VALIDATING: "AUTOMATED_VALIDATION",
    ApplicationStatus.IN_REVIEW: "ANALYST_REVIEW",
    ApplicationStatus.DOCS_REQUESTED: "DOCUMENTS",
    ApplicationStatus.APPROVED: "OFFER",
    ApplicationStatus.COUNTEROFFERED: "OFFER",
    ApplicationStatus.OFFER_ACCEPTED: "AGREEMENT",
    ApplicationStatus.AGREEMENT_PREPARATION: "AGREEMENT",
    ApplicationStatus.REJECTED: "CLOSED",
    ApplicationStatus.ISSUED: "CLOSED",
}

TERMINAL_STATUSES = {ApplicationStatus.REJECTED, ApplicationStatus.ISSUED}


def can_transition(current: ApplicationStatus, target: ApplicationStatus) -> bool:
    if current == target:
        return True
    return target in STATUS_TRANSITIONS.get(current, set())


def assert_can_transition(current: ApplicationStatus, target: ApplicationStatus) -> None:
    if current == target:
        return
    if not can_transition(current, target):
        raise AppError(
            "INVALID_TRANSITION",
            f"Переход {current.value} → {target.value} запрещён",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "status", "code": f"{current.value}->{target.value}"}],
        )


def active_workflow(app: CreditApplication) -> ApplicationWorkflow | None:
    workflows = list(app.workflows or [])
    if not workflows:
        return None
    for wf in workflows:
        if wf.status in (WorkflowStatus.PENDING, WorkflowStatus.RUNNING):
            return wf
    return workflows[0]


def transition_application(
    db: Session,
    app: CreditApplication,
    to_status: ApplicationStatus,
    *,
    actor: User | None,
    comment: str | None = None,
    bump_version: bool = True,
) -> ApplicationStatusHistory:
    from_status = app.status
    assert_can_transition(from_status, to_status)

    if from_status == to_status:
        return ApplicationStatusHistory(
            application_id=app.id,
            from_status=from_status,
            to_status=to_status,
            changed_by=actor.id if actor else None,
            comment=comment or "noop",
        )

    now = utcnow()
    actor_name = actor.full_name if actor else "system"

    event = ApplicationStatusHistory(
        application_id=app.id,
        from_status=from_status,
        to_status=to_status,
        changed_by=actor.id if actor else None,
        comment=comment,
    )
    db.add(event)

    app.status = to_status
    app.current_step = STEP_BY_STATUS.get(to_status, app.current_step)
    if bump_version:
        app.version = int(app.version or 1) + 1
    if to_status in (
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.COUNTEROFFERED,
    ):
        app.decided_at = now

    history = list(app.status_history or [])
    history.append(
        {
            "status": to_status.value,
            "at": now.isoformat(),
            "by": actor_name,
            **({"comment": comment} if comment else {}),
        }
    )
    app.status_history = history

    wf = active_workflow(app)
    if wf is not None:
        wf.current_step = app.current_step
        if wf.status == WorkflowStatus.PENDING:
            wf.status = WorkflowStatus.RUNNING
            if wf.started_at is None:
                wf.started_at = now
        if to_status in TERMINAL_STATUSES:
            wf.status = WorkflowStatus.COMPLETED
            wf.finished_at = now
            wf.result = {"final_status": to_status.value}

    db.flush()
    return event


def create_workflow(
    db: Session,
    app: CreditApplication,
    *,
    actor: User,
    workflow_type: str = "CREDIT_REVIEW",
) -> ApplicationWorkflow:
    now = utcnow()
    wf = ApplicationWorkflow(
        application_id=app.id,
        workflow_type=workflow_type,
        status=WorkflowStatus.RUNNING,
        current_step="AUTOMATED_VALIDATION",
        context={"triggered_by": actor.id, "source": "submit"},
        started_at=now,
    )
    db.add(wf)
    db.flush()
    # Держим relationship в sync для active_workflow в том же запросе
    if app.workflows is None:
        app.workflows = [wf]
    else:
        app.workflows.append(wf)
    return wf


def _add_check(
    db: Session,
    *,
    app: CreditApplication,
    workflow_id: str | None,
    check_key: str,
    audience: CheckAudience,
    status: str,
    explanation: str,
    score: int | None = None,
    reason_codes: list[str] | None = None,
    payload: dict[str, Any] | None = None,
) -> ApplicationCheck:
    check = ApplicationCheck(
        application_id=app.id,
        workflow_id=workflow_id,
        check_key=check_key,
        audience=audience.value,
        status=status,
        score=score,
        reason_codes=reason_codes or [],
        explanation=explanation,
        payload=payload or {},
    )
    db.add(check)
    return check


def run_automated_validation(
    db: Session,
    app: CreditApplication,
    *,
    actor: User | None,
    workflow: ApplicationWorkflow | None = None,
) -> list[ApplicationCheck]:
    """Синхронный mock-конвейер: SUBMITTED → VALIDATING → IN_REVIEW + checks."""
    wf = workflow or active_workflow(app)
    wf_id = wf.id if wf else None

    if app.status == ApplicationStatus.SUBMITTED:
        transition_application(
            db,
            app,
            ApplicationStatus.VALIDATING,
            actor=actor,
            comment="Автоматическая валидация",
            bump_version=False,
        )
    elif app.status == ApplicationStatus.DOCS_REQUESTED:
        transition_application(
            db,
            app,
            ApplicationStatus.VALIDATING,
            actor=actor,
            comment="Повторная проверка после документов",
            bump_version=False,
        )
    elif app.status != ApplicationStatus.VALIDATING:
        return list(app.checks or [])

    if wf is not None:
        wf.status = WorkflowStatus.RUNNING
        wf.current_step = "AUTOMATED_VALIDATION"

    checks: list[ApplicationCheck] = []
    company = db.get(Company, app.company_id)
    registry_ok = bool(company and company.registry_status == "ACTIVE")
    checks.append(
        _add_check(
            db,
            app=app,
            workflow_id=wf_id,
            check_key="REGISTRY_STATUS",
            audience=CheckAudience.PUBLIC,
            status="PASSED" if registry_ok else "WARNING",
            explanation="Статус в реестре ACTIVE" if registry_ok else "Реестр не ACTIVE",
            reason_codes=[] if registry_ok else ["REGISTRY_NOT_ACTIVE"],
        )
    )

    snap = db.scalar(
        select(FinancialSnapshot.id)
        .where(FinancialSnapshot.company_id == app.company_id)
        .limit(1)
    )
    has_fin = snap is not None
    checks.append(
        _add_check(
            db,
            app=app,
            workflow_id=wf_id,
            check_key="FINANCIALS_PRESENT",
            audience=CheckAudience.PUBLIC,
            status="PASSED" if has_fin else "FAILED",
            explanation="Финансовый снимок найден" if has_fin else "Нет финансовых данных",
            reason_codes=[] if has_fin else ["MISSING_FINANCIALS"],
        )
    )

    product_ok = app.product_id is not None
    checks.append(
        _add_check(
            db,
            app=app,
            workflow_id=wf_id,
            check_key="PRODUCT_FIT",
            audience=CheckAudience.PUBLIC,
            status="PASSED" if product_ok else "FAILED",
            explanation="Продукт выбран" if product_ok else "Продукт не выбран",
        )
    )

    docs = list(app.documents or [])
    uploaded = [d for d in docs if (d.status or "") not in ("requested",)]
    checks.append(
        _add_check(
            db,
            app=app,
            workflow_id=wf_id,
            check_key="DOCUMENTS_BASELINE",
            audience=CheckAudience.PUBLIC,
            status="PASSED" if uploaded else "WARNING",
            explanation=f"Загружено документов: {len(uploaded)}",
            payload={"uploaded_count": len(uploaded)},
        )
    )

    score = int(app.readiness_score or 50)
    checks.append(
        _add_check(
            db,
            app=app,
            workflow_id=wf_id,
            check_key="READINESS_PROXY",
            audience=CheckAudience.INTERNAL,
            status="PASSED" if score >= 40 else "WARNING",
            score=score,
            explanation=f"Индекс готовности {score}/100 (не скоринг банка)",
            reason_codes=[] if score >= 40 else ["LOW_READINESS"],
        )
    )

    db.flush()

    hard_fail = any(c.status == "FAILED" and c.audience == CheckAudience.PUBLIC.value for c in checks)
    if hard_fail:
        # Оставляем на ручной разбор, не auto-reject в демо
        target = ApplicationStatus.IN_REVIEW
        comment = "Автопроверка завершена с ошибками — передано аналитику"
    else:
        target = ApplicationStatus.IN_REVIEW
        comment = "Автопроверка пройдена"

    transition_application(
        db,
        app,
        target,
        actor=actor,
        comment=comment,
        bump_version=False,
    )
    if wf is not None:
        wf.current_step = "ANALYST_REVIEW"
        ctx = dict(wf.context or {})
        ctx["auto_checks"] = [c.check_key for c in checks]
        wf.context = ctx

    db.flush()
    return checks


def public_checks(app: CreditApplication) -> list[ApplicationCheck]:
    return [c for c in (app.checks or []) if c.audience == CheckAudience.PUBLIC.value]


def analyst_visible_checks(app: CreditApplication) -> list[ApplicationCheck]:
    return list(app.checks or [])


def serialize_check(check: ApplicationCheck, *, include_internal: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": check.id,
        "check_key": check.check_key,
        "status": check.status,
        "score": check.score,
        "reason_codes": check.reason_codes or [],
        "explanation": check.explanation,
        "created_at": check.created_at,
    }
    if include_internal:
        data["audience"] = check.audience
        data["workflow_id"] = check.workflow_id
        data["payload"] = check.payload or {}
    return data
