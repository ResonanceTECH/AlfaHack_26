from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ApplicationStatus, ProductStatus, UserRole
from app.models.application import ApplicationWorkflow, CreditApplication
from app.models.company import Company
from app.models.credit import CreditProduct
from app.models.finance import FinancialSnapshot
from app.models.funding import FundingNeed
from app.models.user import User
from app.services.readiness import compute_readiness
from app.services.recommendations import business_age_months
from app.services.workflow import (
    active_workflow,
    create_workflow,
    run_automated_validation,
    transition_application,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def load_application(db: Session, app_id: str) -> CreditApplication | None:
    return db.scalar(
        select(CreditApplication)
        .options(
            joinedload(CreditApplication.documents),
            joinedload(CreditApplication.comments),
            joinedload(CreditApplication.assigned_manager),
            joinedload(CreditApplication.workflows),
            joinedload(CreditApplication.checks),
            joinedload(CreditApplication.document_requests),
        )
        .where(CreditApplication.id == app_id)
    )


def application_number(app: CreditApplication) -> str:
    meta = app.form_data or {}
    if meta.get("application_number"):
        return str(meta["application_number"])
    year = (app.submitted_at or app.created_at or utcnow()).year
    short = app.id.replace("-", "")[-4:].upper()
    return f"ABC-{year}-{short}"


def serialize_application(app: CreditApplication) -> dict[str, Any]:
    manager_name = app.assigned_manager.full_name if app.assigned_manager else None
    return {
        "id": app.id,
        "company_id": app.company_id,
        "funding_need_id": app.funding_need_id,
        "product_id": app.product_id,
        "product_name": app.product_name,
        "product_type": app.product_type,
        "goal_type": app.goal_type,
        "status": app.status,
        "current_step": app.current_step,
        "version": app.version,
        "amount": app.amount,
        "requested_amount": app.amount,
        "term_months": app.term_months,
        "rate": app.rate,
        "purpose": app.purpose or "",
        "assigned_manager_id": app.assigned_manager_id,
        "assigned_manager_name": manager_name,
        "readiness_score": app.readiness_score or 0,
        "documents": [
            {
                "id": d.id,
                "type": d.document_type or d.doc_type,
                "name": d.name or d.file_name or "",
                "size": d.size or d.size_bytes or 0,
                "uploaded_at": d.uploaded_at,
                "status": d.status,
            }
            for d in (app.documents or [])
        ],
        "comments": [
            {
                "id": c.id,
                "author_id": c.author_id,
                "author_name": c.author_name or "",
                "author_role": c.author_role or "",
                "text": c.text,
                "created_at": c.created_at,
            }
            for c in (app.comments or [])
        ],
        "status_history": app.status_history or [],
        "created_at": app.created_at,
        "updated_at": app.updated_at,
        "saved_at": app.updated_at,
        "submitted_at": app.submitted_at,
        "ai_summary": app.ai_summary,
        "application_number": application_number(app) if app.status != ApplicationStatus.DRAFT else None,
        "currency": "RUB",
    }


def validate_application(db: Session, app: CreditApplication) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    product = db.get(CreditProduct, app.product_id) if app.product_id else None
    if product is None:
        errors.append({"field": "product_id", "code": "REQUIRED", "message": "Не выбран продукт"})
    else:
        if product.status != ProductStatus.PUBLISHED or not product.is_active:
            errors.append({"field": "product_id", "code": "NOT_PUBLISHED", "message": "Продукт недоступен"})
        if app.amount < product.amount_min or app.amount > product.amount_max:
            errors.append(
                {
                    "field": "requested_amount",
                    "code": "OUT_OF_RANGE",
                    "message": f"Сумма вне диапазона {product.amount_min}–{product.amount_max}",
                }
            )
        if app.term_months < product.term_min or app.term_months > product.term_max:
            errors.append(
                {
                    "field": "term_months",
                    "code": "OUT_OF_RANGE",
                    "message": f"Срок вне диапазона {product.term_min}–{product.term_max}",
                }
            )

    company = db.get(Company, app.company_id)
    if company is None:
        errors.append({"field": "company_id", "code": "NOT_FOUND", "message": "Компания не найдена"})
    elif company.registry_status != "ACTIVE":
        warnings.append(
            {
                "field": "registry_status",
                "code": "REGISTRY_NOT_ACTIVE",
                "message": "Статус в реестре не ACTIVE — рекомендуется verify",
            }
        )

    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == app.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    if snap is None:
        errors.append(
            {
                "field": "financials",
                "code": "MISSING",
                "message": "Нет финансового снимка компании",
            }
        )

    if app.funding_need_id:
        need = db.get(FundingNeed, app.funding_need_id)
        if need is None or need.company_id != app.company_id:
            errors.append(
                {
                    "field": "funding_need_id",
                    "code": "NOT_FOUND",
                    "message": "Потребность не найдена",
                }
            )

    if not (app.purpose or "").strip() and app.goal_type is None:
        warnings.append(
            {
                "field": "purpose",
                "code": "EMPTY",
                "message": "Не указана цель финансирования",
            }
        )

    readiness = None
    if company and product:
        readiness = compute_readiness(
            company=company,
            financials=snap,
            product=product,
            documents=list(app.documents or []),
            business_age_months=business_age_months(company.registration_date),
        )
        if readiness["score"] < 40:
            warnings.append(
                {
                    "field": "readiness_score",
                    "code": "LOW",
                    "message": f"Низкий индекс готовности: {readiness['score']}/100",
                }
            )

    can_submit = len(errors) == 0 and app.status in (
        ApplicationStatus.DRAFT,
        ApplicationStatus.DOCS_REQUESTED,
    )
    return {
        "application_id": app.id,
        "status": app.status,
        "can_submit": can_submit,
        "errors": errors,
        "warnings": warnings,
        "readiness_score": readiness["score"] if readiness else app.readiness_score,
        "checked_at": utcnow(),
    }


def create_draft(
    db: Session,
    *,
    company_id: str,
    user: User,
    product: CreditProduct,
    amount: Decimal,
    term_months: int,
    rate: Decimal | None,
    purpose: str | None,
    funding_need_id: str | None,
    goal_type: Any,
    idempotency_key: str | None,
) -> CreditApplication:
    company = db.get(Company, company_id)
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    readiness = compute_readiness(
        company=company,
        financials=snap,
        product=product,
        documents=[],
        business_age_months=business_age_months(company.registration_date) if company else 0,
    )
    now = utcnow()
    if rate is None:
        rate = (Decimal(str(product.rate_min)) + Decimal(str(product.rate_max))) / 2

    app = CreditApplication(
        company_id=company_id,
        created_by=user.id,
        product_id=product.id,
        product_name=product.name,
        product_type=product.type,
        funding_need_id=funding_need_id,
        goal_type=goal_type,
        status=ApplicationStatus.DRAFT,
        current_step="CREDIT_PARAMETERS",
        amount=amount,
        term_months=term_months,
        rate=rate,
        purpose=purpose or "",
        readiness_score=readiness["score"],
        version=1,
        idempotency_key=idempotency_key,
        status_history=[{"status": "DRAFT", "at": now.isoformat(), "by": user.full_name}],
        ai_summary=(
            f"Черновик заявки на «{product.name}» на сумму {amount} ₽. "
            f"Индекс готовности: {readiness['score']}/100. Не является скорингом банка."
        ),
        form_data={},
    )
    db.add(app)
    db.flush()
    return app


def _submit_payload(app: CreditApplication, wf: ApplicationWorkflow | None) -> dict[str, Any]:
    return {
        "application_id": app.id,
        "application_number": application_number(app),
        "status": app.status,
        "workflow_id": wf.id if wf else None,
        "next_step": app.current_step or "AUTOMATED_VALIDATION",
    }


def submit_draft(
    db: Session,
    *,
    app: CreditApplication,
    user: User,
    idempotency_key: str | None,
) -> tuple[CreditApplication, ApplicationWorkflow | None, dict[str, Any]]:
    form = dict(app.form_data or {})
    wf = active_workflow(app)

    # Уже в конвейере — идемпотентный ответ
    if app.status not in (ApplicationStatus.DRAFT, ApplicationStatus.DOCS_REQUESTED):
        if idempotency_key and form.get("submit_idempotency_key") == idempotency_key:
            return app, wf, _submit_payload(app, wf)
        if app.status in (
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.VALIDATING,
            ApplicationStatus.IN_REVIEW,
        ):
            return app, wf, _submit_payload(app, wf)

    if idempotency_key and form.get("submit_idempotency_key") == idempotency_key:
        return app, wf, _submit_payload(app, wf)

    validation = validate_application(db, app)
    if not validation["can_submit"]:
        raise ValueError(validation)

    analyst = db.scalar(
        select(User).where(User.role == UserRole.ANALYST, User.is_active.is_(True))
    )
    now = utcnow()
    if app.submitted_at is None:
        app.submitted_at = now
    if analyst:
        app.assigned_manager_id = app.assigned_manager_id or analyst.id
        app.assigned_analyst_id = app.assigned_analyst_id or analyst.id

    year = now.year
    short = app.id.replace("-", "")[-4:].upper()
    number = form.get("application_number") or f"ABC-{year}-{short}"
    form["application_number"] = number
    if idempotency_key:
        form["submit_idempotency_key"] = idempotency_key
    app.form_data = form

    if app.status == ApplicationStatus.DRAFT:
        transition_application(
            db,
            app,
            ApplicationStatus.SUBMITTED,
            actor=user,
            comment="Отправка заявки",
        )
        wf = create_workflow(db, app, actor=user)
        # Демо: сразу прогоняем auto-validation → IN_REVIEW
        run_automated_validation(db, app, actor=user, workflow=wf)
    elif app.status == ApplicationStatus.DOCS_REQUESTED:
        wf = active_workflow(app) or create_workflow(db, app, actor=user)
        run_automated_validation(db, app, actor=user, workflow=wf)
    else:
        transition_application(
            db,
            app,
            ApplicationStatus.SUBMITTED,
            actor=user,
            comment="Отправка заявки",
        )
        wf = create_workflow(db, app, actor=user)
        run_automated_validation(db, app, actor=user, workflow=wf)

    db.flush()
    wf = active_workflow(app) or wf
    return app, wf, _submit_payload(app, wf)
