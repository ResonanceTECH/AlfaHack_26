from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.config import get_settings
from app.core.enums import STATUS_TRANSITIONS, ApplicationStatus, UserRole
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.application import ApplicationComment, ApplicationDocument, CreditApplication
from app.models.credit import CreditProduct
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    DocsRequestIn,
    StatusUpdate,
)
from app.services.access import (
    MANAGER_ROLES,
    require_application_access,
    require_company_access,
    require_roles,
    resolve_company_id,
)
from app.services.audit import write_audit
from app.services.readiness import compute_readiness
from app.services.recommendations import business_age_months
from app.models.company import Company
from app.models.finance import FinancialSnapshot

router = APIRouter(tags=["applications"])

def _serialize(app: CreditApplication) -> dict:
    manager_name = None
    if app.assigned_manager:
        manager_name = app.assigned_manager.full_name
    return {
        "id": app.id,
        "company_id": app.company_id,
        "product_id": app.product_id,
        "product_name": app.product_name,
        "status": app.status,
        "amount": app.amount,
        "term_months": app.term_months,
        "rate": app.rate,
        "purpose": app.purpose,
        "assigned_manager_id": app.assigned_manager_id,
        "assigned_manager_name": manager_name,
        "readiness_score": app.readiness_score,
        "documents": [
            {
                "id": d.id,
                "type": d.document_type,
                "name": d.name,
                "size": d.size,
                "uploaded_at": d.uploaded_at,
                "status": d.status,
            }
            for d in app.documents
        ],
        "comments": [
            {
                "id": c.id,
                "author_id": c.author_id,
                "author_name": c.author_name,
                "author_role": c.author_role,
                "text": c.text,
                "created_at": c.created_at,
            }
            for c in app.comments
        ],
        "status_history": app.status_history or [],
        "created_at": app.created_at,
        "updated_at": app.updated_at,
        "ai_summary": app.ai_summary,
    }

def _load_app(db: DbDep, app_id: str) -> CreditApplication:
    app = db.scalar(
        select(CreditApplication)
        .options(
            joinedload(CreditApplication.documents),
            joinedload(CreditApplication.comments),
            joinedload(CreditApplication.assigned_manager),
        )
        .where(CreditApplication.id == app_id)
    )
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    return app

@router.post("/applications", response_model=ApplicationOut, status_code=201)
def create_application(
    body: ApplicationCreate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> dict:
    require_company_access(db, user, body.company_id, write=True)

    if body.idempotency_key:
        existing = db.scalar(
            select(CreditApplication).where(CreditApplication.idempotency_key == body.idempotency_key)
        )
        if existing:
            if existing.company_id != body.company_id:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="idempotency_key уже используется другой компанией",
                )
            require_application_access(db, user, existing, write=True)
            return _serialize(_load_app(db, existing.id))

    product = db.get(CreditProduct, body.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")

    company = db.get(Company, body.company_id)
    financials = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == body.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    readiness = compute_readiness(
        company=company,
        financials=financials,
        product=product,
        documents=[],
        business_age_months=business_age_months(company.registration_date) if company else 0,
    )

    now = datetime.now(timezone.utc).isoformat()
    app = CreditApplication(
        company_id=body.company_id,
        product_id=product.id,
        product_name=product.name,
        status=ApplicationStatus.DRAFT,
        amount=body.amount,
        term_months=body.term_months,
        rate=body.rate,
        purpose=body.purpose,
        readiness_score=readiness["score"],
        status_history=[{"status": "draft", "at": now, "by": user.full_name}],
        idempotency_key=body.idempotency_key,
        ai_summary=(
            f"Черновик заявки на «{product.name}» на сумму {body.amount} ₽. "
            f"Индекс готовности: {readiness['score']}/100. Не является скорингом банка."
        ),
    )
    db.add(app)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id="pending",
        action="create",
        correlation_id=cid,
    )
    db.commit()
    return _serialize(_load_app(db, app.id))

@router.get("/applications", response_model=list[ApplicationOut])
def list_my_applications(db: DbDep, user: CurrentUser, company_id: str | None = None) -> list[dict]:
    q = select(CreditApplication).options(
        joinedload(CreditApplication.documents),
        joinedload(CreditApplication.comments),
        joinedload(CreditApplication.assigned_manager),
    )

    if user.role == UserRole.ADMIN:
        if company_id:
            q = q.where(CreditApplication.company_id == company_id)
    elif user.role in MANAGER_ROLES:
        q = q.where(CreditApplication.status != ApplicationStatus.DRAFT)
        if company_id:
            require_company_access(db, user, company_id)
            q = q.where(CreditApplication.company_id == company_id)
    else:
        cid = resolve_company_id(db, user, company_id)
        q = q.where(CreditApplication.company_id == cid)

    apps = db.scalars(q.order_by(CreditApplication.updated_at.desc())).unique().all()
    return [_serialize(a) for a in apps]

@router.get("/applications/{application_id}", response_model=ApplicationOut)
def get_application(application_id: str, db: DbDep, user: CurrentUser) -> dict:
    app = _load_app(db, application_id)
    require_application_access(db, user, app)
    return _serialize(app)

@router.patch("/applications/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: str, body: ApplicationUpdate, db: DbDep, user: CurrentUser
) -> dict:
    app = _load_app(db, application_id)
    require_application_access(db, user, app, write=True)
    if app.status != ApplicationStatus.DRAFT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Редактировать можно только черновик")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(app, k, v)
    db.commit()
    return _serialize(_load_app(db, app.id))

@router.post("/applications/{application_id}/submit", response_model=ApplicationOut)
def submit_application(
    application_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId, idempotency_key: str | None = None
) -> dict:
    app = _load_app(db, application_id)
    require_application_access(db, user, app, write=True)

    if app.status == ApplicationStatus.SUBMITTED:
        return _serialize(app)

    if app.status != ApplicationStatus.DRAFT and app.status != ApplicationStatus.DOCS_REQUESTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Заявку нельзя отправить из текущего статуса")

    manager = db.scalar(select(User).where(User.role == UserRole.MANAGER, User.is_active.is_(True)))
    now = datetime.now(timezone.utc).isoformat()
    app.status = ApplicationStatus.SUBMITTED
    app.assigned_manager_id = manager.id if manager else None
    history = list(app.status_history or [])
    history.append({"status": "submitted", "at": now, "by": user.full_name})
    app.status_history = history

    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="submit",
        correlation_id=cid,
    )
    db.commit()
    return _serialize(_load_app(db, app.id))

@router.post("/applications/{application_id}/documents", response_model=ApplicationOut)
async def upload_document(
    application_id: str,
    db: DbDep,
    user: CurrentUser,
    file: UploadFile = File(...),
    document_type: str = "other",
) -> dict:
    app = _load_app(db, application_id)
    require_application_access(db, user, app, write=True)
    settings = get_settings()
    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Файл больше {settings.max_upload_mb} МБ")

    upload_dir = Path(settings.upload_dir) / application_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "file.bin").suffix
    key = f"{uuid4().hex}{ext}"
    path = upload_dir / key
    path.write_bytes(content)

    requested = next(
        (d for d in app.documents if d.document_type == document_type and d.status == "requested"),
        None,
    )
    if requested:
        requested.name = file.filename or key
        requested.size = len(content)
        requested.storage_key = str(path)
        requested.status = "uploaded"
    else:
        db.add(
            ApplicationDocument(
                application_id=app.id,
                document_type=document_type,
                name=file.filename or key,
                size=len(content),
                storage_key=str(path),
                status="uploaded",
            )
        )

    if app.status == ApplicationStatus.DOCS_REQUESTED:
        now = datetime.now(timezone.utc).isoformat()
        app.status = ApplicationStatus.IN_REVIEW
        history = list(app.status_history or [])
        history.append({"status": "in_review", "at": now, "by": user.full_name})
        app.status_history = history

    db.commit()
    return _serialize(_load_app(db, app.id))

@router.patch("/applications/{application_id}/status", response_model=ApplicationOut)
def change_status(
    application_id: str, body: StatusUpdate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> dict:
    require_roles(user, UserRole.MANAGER, UserRole.RISK_ANALYST, UserRole.ADMIN)
    app = _load_app(db, application_id)

    if body.idempotency_key and app.status == body.status:
        return _serialize(app)

    allowed = STATUS_TRANSITIONS.get(app.status, set())
    if body.status not in allowed and not (
        app.status == ApplicationStatus.SUBMITTED and body.status == ApplicationStatus.DOCS_REQUESTED
    ):
        if body.status not in allowed:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Переход {app.status.value} → {body.status.value} запрещён",
            )

    now = datetime.now(timezone.utc).isoformat()
    app.status = body.status
    if app.assigned_manager_id is None:
        app.assigned_manager_id = user.id
    history = list(app.status_history or [])
    history.append({"status": body.status.value, "at": now, "by": user.full_name})
    app.status_history = history

    if body.comment:
        db.add(
            ApplicationComment(
                application_id=app.id,
                author_id=user.id,
                author_name=user.full_name,
                author_role=user.role.value,
                text=body.comment,
            )
        )

    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="status_change",
        details={"status": body.status.value},
        correlation_id=cid,
    )
    db.commit()
    return _serialize(_load_app(db, app.id))

@router.post("/applications/{application_id}/request-documents", response_model=ApplicationOut)
def request_documents(
    application_id: str, body: DocsRequestIn, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> dict:
    require_roles(user, UserRole.MANAGER, UserRole.RISK_ANALYST, UserRole.ADMIN)
    app = _load_app(db, application_id)
    now = datetime.now(timezone.utc).isoformat()
    app.status = ApplicationStatus.DOCS_REQUESTED
    history = list(app.status_history or [])
    history.append({"status": "docs_requested", "at": now, "by": user.full_name})
    app.status_history = history

    db.add(
        ApplicationDocument(
            application_id=app.id,
            document_type=body.document_type,
            name=f"Запрошено: {body.document_type}",
            size=0,
            status="requested",
        )
    )
    db.add(
        ApplicationComment(
            application_id=app.id,
            author_id=user.id,
            author_name=user.full_name,
            author_role=user.role.value,
            text=body.comment or f"Запрошен документ: {body.document_type}",
        )
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="request_documents",
        details={"document_type": body.document_type},
        correlation_id=cid,
    )
    db.commit()
    return _serialize(_load_app(db, app.id))
