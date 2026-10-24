from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.enums import ApplicationStatus, ProductStatus, UserRole
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.application import ApplicationComment, CreditApplication
from app.models.credit import CreditProduct
from app.models.funding import FundingNeed
from app.models.user import User
from app.schemas.application import (
    ApplicationChecksOut,
    ApplicationCreate,
    ApplicationDocumentsOut,
    ApplicationDraftCreate,
    ApplicationDraftCreated,
    ApplicationOut,
    ApplicationStatusOut,
    ApplicationSubmitOut,
    ApplicationUpdate,
    ApplicationValidationOut,
    DocsRequestIn,
    DocumentMetaOut,
    DocumentRequestOut,
    DocumentRequestRespondIn,
    PublicCheckOut,
    RequiredDocumentSlot,
    StatusUpdate,
    ValidationIssue,
)
from app.services.access import (
    ANALYST_ROLES,
    require_application_access,
    require_company_access,
    require_roles,
    resolve_company_id,
)
from app.services.applications import (
    create_draft,
    load_application,
    serialize_application,
    submit_draft,
    validate_application,
)
from app.services.audit import write_audit
from app.services.documents import (
    create_document_request,
    list_documents_bundle,
    resolve_download_path,
    respond_document_request,
    serialize_document,
    serialize_document_request,
    upload_document as store_application_document,
)
from app.services.workflow import public_checks, serialize_check, transition_application

router = APIRouter(tags=["applications"])


def _load_app(db: DbDep, app_id: str) -> CreditApplication:
    app = load_application(db, app_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    return app


def _company_app(db: DbDep, company_id: str, application_id: str, user: CurrentUser) -> CreditApplication:
    require_company_access(db, user, company_id)
    app = _load_app(db, application_id)
    if app.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app)
    return app


def _published_product(db: DbDep, product_id: str) -> CreditProduct:
    product = db.get(CreditProduct, product_id)
    if product is None or not product.is_active or product.status != ProductStatus.PUBLISHED:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")
    return product


def _next_action(app: CreditApplication) -> str | None:
    mapping = {
        ApplicationStatus.DRAFT: "Заполните параметры и отправьте заявку",
        ApplicationStatus.SUBMITTED: "Ожидайте автоматическую проверку",
        ApplicationStatus.VALIDATING: "Идёт проверка данных",
        ApplicationStatus.IN_REVIEW: "Заявка на рассмотрении аналитика",
        ApplicationStatus.DOCS_REQUESTED: "Загрузите запрошенные документы",
        ApplicationStatus.APPROVED: "Рассмотрите предложение банка",
        ApplicationStatus.COUNTEROFFERED: "Рассмотрите альтернативное предложение",
        ApplicationStatus.OFFER_ACCEPTED: "Ожидайте подготовку договора",
        ApplicationStatus.AGREEMENT_PREPARATION: "Ознакомьтесь с договором",
        ApplicationStatus.REJECTED: None,
        ApplicationStatus.ISSUED: None,
    }
    return mapping.get(app.status)


# --- Спека A4: company-scoped ---


@router.get("/companies/{company_id}/applications", response_model=list[ApplicationOut])
def list_company_applications(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
) -> list[ApplicationOut]:
    require_company_access(db, user, company_id)
    q = (
        select(CreditApplication)
        .options(
            joinedload(CreditApplication.documents),
            joinedload(CreditApplication.comments),
            joinedload(CreditApplication.assigned_manager),
        )
        .where(CreditApplication.company_id == company_id)
    )
    if status_filter is not None:
        q = q.where(CreditApplication.status == status_filter)
    if user.role in ANALYST_ROLES:
        q = q.where(CreditApplication.status != ApplicationStatus.DRAFT)
    apps = db.scalars(q.order_by(CreditApplication.updated_at.desc())).unique().all()
    return [ApplicationOut(**serialize_application(a)) for a in apps]


@router.get("/companies/{company_id}/applications/drafts", response_model=list[ApplicationOut])
def list_drafts(company_id: str, db: DbDep, user: CurrentUser) -> list[ApplicationOut]:
    require_company_access(db, user, company_id)
    apps = db.scalars(
        select(CreditApplication)
        .options(
            joinedload(CreditApplication.documents),
            joinedload(CreditApplication.comments),
            joinedload(CreditApplication.assigned_manager),
        )
        .where(
            CreditApplication.company_id == company_id,
            CreditApplication.status == ApplicationStatus.DRAFT,
        )
        .order_by(CreditApplication.updated_at.desc())
    ).unique().all()
    return [ApplicationOut(**serialize_application(a)) for a in apps]


@router.post(
    "/companies/{company_id}/applications",
    response_model=ApplicationDraftCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_company_application(
    company_id: str,
    body: ApplicationDraftCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApplicationDraftCreated:
    require_company_access(db, user, company_id, write=True)

    if idempotency_key:
        existing = db.scalar(
            select(CreditApplication).where(
                CreditApplication.company_id == company_id,
                CreditApplication.idempotency_key == idempotency_key,
            )
        )
        if existing:
            return ApplicationDraftCreated(
                id=existing.id,
                status=existing.status,
                current_step=existing.current_step or "CREDIT_PARAMETERS",
                version=existing.version,
                saved_at=existing.updated_at or existing.created_at,
                company_id=existing.company_id,
                product_id=existing.product_id,
                requested_amount=existing.amount,
                term_months=existing.term_months,
            )

    product = _published_product(db, body.product_id)
    goal_type = body.goal_type
    if body.funding_need_id:
        need = db.get(FundingNeed, body.funding_need_id)
        if need is None or need.company_id != company_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")
        goal_type = goal_type or need.goal_type

    app = create_draft(
        db,
        company_id=company_id,
        user=user,
        product=product,
        amount=body.requested_amount,
        term_months=body.term_months,
        rate=body.rate,
        purpose=body.purpose,
        funding_need_id=body.funding_need_id,
        goal_type=goal_type,
        idempotency_key=idempotency_key,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="create",
        details={"product_id": product.id, "amount": str(body.requested_amount)},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(app)
    return ApplicationDraftCreated(
        id=app.id,
        status=app.status,
        current_step=app.current_step or "CREDIT_PARAMETERS",
        version=app.version,
        saved_at=app.updated_at or app.created_at,
        company_id=app.company_id,
        product_id=app.product_id,
        requested_amount=app.amount,
        term_months=app.term_months,
    )


@router.get(
    "/companies/{company_id}/applications/{application_id}",
    response_model=ApplicationOut,
)
def get_company_application(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser
) -> ApplicationOut:
    app = _company_app(db, company_id, application_id, user)
    return ApplicationOut(**serialize_application(app))


@router.patch(
    "/companies/{company_id}/applications/{application_id}",
    response_model=ApplicationOut,
)
def patch_company_application(
    company_id: str,
    application_id: str,
    body: ApplicationUpdate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> ApplicationOut:
    require_company_access(db, user, company_id, write=True)
    app = _load_app(db, application_id)
    if app.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)
    if app.status != ApplicationStatus.DRAFT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Редактировать можно только черновик")

    expected = body.version
    if if_match is not None:
        try:
            expected = int(if_match.strip().strip('"'))
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="If-Match должен быть числом version") from exc
    if expected is not None and expected != app.version:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Конфликт версии: ожидали {expected}, сейчас {app.version}",
        )

    patch = body.model_dump(exclude_unset=True)
    patch.pop("version", None)
    if "requested_amount" in patch:
        patch["amount"] = patch.pop("requested_amount")
    if "product_id" in patch and patch["product_id"]:
        product = _published_product(db, patch["product_id"])
        app.product_id = product.id
        app.product_name = product.name
        app.product_type = product.type
        patch.pop("product_id")
    if "funding_need_id" in patch and patch["funding_need_id"]:
        need = db.get(FundingNeed, patch["funding_need_id"])
        if need is None or need.company_id != company_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")

    for k, v in patch.items():
        setattr(app, k, v)
    app.version = int(app.version or 1) + 1
    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="update",
        details={"version": app.version, **{k: str(v) for k, v in patch.items()}},
        correlation_id=cid,
    )
    db.commit()
    return ApplicationOut(**serialize_application(_load_app(db, app.id)))


@router.delete(
    "/companies/{company_id}/applications/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_draft(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> Response:
    require_company_access(db, user, company_id, write=True)
    app = _load_app(db, application_id)
    if app.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)
    if app.status != ApplicationStatus.DRAFT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Удалить можно только черновик")
    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="delete_draft",
        correlation_id=cid,
    )
    db.delete(app)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/companies/{company_id}/applications/{application_id}/validation",
    response_model=ApplicationValidationOut,
)
def validate_company_application(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser
) -> ApplicationValidationOut:
    app = _company_app(db, company_id, application_id, user)
    raw = validate_application(db, app)
    return ApplicationValidationOut(
        application_id=raw["application_id"],
        status=raw["status"],
        can_submit=raw["can_submit"],
        errors=[ValidationIssue(**e) for e in raw["errors"]],
        warnings=[ValidationIssue(**w) for w in raw["warnings"]],
        readiness_score=raw.get("readiness_score"),
        checked_at=raw["checked_at"],
    )


@router.post(
    "/companies/{company_id}/applications/{application_id}/submit",
    response_model=ApplicationSubmitOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_company_application(
    company_id: str,
    application_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApplicationSubmitOut:
    require_company_access(db, user, company_id, write=True)
    app = _load_app(db, application_id)
    if app.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)

    if app.status not in (ApplicationStatus.DRAFT, ApplicationStatus.DOCS_REQUESTED, ApplicationStatus.SUBMITTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Заявку нельзя отправить из текущего статуса")

    try:
        app, _wf, payload = submit_draft(db, app=app, user=user, idempotency_key=idempotency_key)
    except ValueError as exc:
        raw = exc.args[0] if exc.args else {}
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Заявка не проходит валидацию",
                "errors": raw.get("errors", []) if isinstance(raw, dict) else [],
                "warnings": raw.get("warnings", []) if isinstance(raw, dict) else [],
            },
        ) from exc

    write_audit(
        db,
        actor_id=user.id,
        entity_type="application",
        entity_id=app.id,
        action="submit",
        details={"workflow_id": payload.get("workflow_id"), "idempotency_key": idempotency_key},
        correlation_id=cid,
    )
    db.commit()
    return ApplicationSubmitOut(**payload)


@router.get(
    "/companies/{company_id}/applications/{application_id}/status",
    response_model=ApplicationStatusOut,
)
def application_public_status(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser
) -> ApplicationStatusOut:
    app = _company_app(db, company_id, application_id, user)
    data = serialize_application(app)
    return ApplicationStatusOut(
        application_id=app.id,
        status=app.status,
        current_step=app.current_step,
        next_action=_next_action(app),
        application_number=data.get("application_number"),
        updated_at=app.updated_at,
    )


@router.get(
    "/companies/{company_id}/applications/{application_id}/checks",
    response_model=ApplicationChecksOut,
)
def application_public_checks(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser
) -> ApplicationChecksOut:
    app = _company_app(db, company_id, application_id, user)
    return ApplicationChecksOut(
        application_id=app.id,
        status=app.status,
        checks=[PublicCheckOut(**serialize_check(c)) for c in public_checks(app)],
    )


@router.get(
    "/companies/{company_id}/applications/{application_id}/documents",
    response_model=ApplicationDocumentsOut,
)
def list_application_documents(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser
) -> ApplicationDocumentsOut:
    app = _company_app(db, company_id, application_id, user)
    raw = list_documents_bundle(db, app)
    return ApplicationDocumentsOut(
        application_id=raw["application_id"],
        required=[RequiredDocumentSlot(**s) for s in raw["required"]],
        documents=[DocumentMetaOut(**d) for d in raw["documents"]],
    )


@router.post(
    "/companies/{company_id}/applications/{application_id}/documents",
    response_model=DocumentMetaOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_company_document(
    company_id: str,
    application_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    file: UploadFile = File(...),
    doc_type: str = Form(default="OTHER"),
    document_request_id: str | None = Form(default=None),
) -> DocumentMetaOut:
    require_company_access(db, user, company_id, write=True)
    app = _load_app(db, application_id)
    if app.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)

    content = await file.read()
    try:
        doc = store_application_document(
            db,
            app=app,
            user=user,
            content=content,
            filename=file.filename,
            content_type=file.content_type,
            doc_type=doc_type,
            document_request_id=document_request_id,
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    write_audit(
        db,
        actor_id=user.id,
        entity_type="application_document",
        entity_id=doc.id,
        action="upload",
        details={"application_id": app.id, "doc_type": doc.doc_type},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(doc)
    return DocumentMetaOut(**serialize_document(doc))


@router.get(
    "/companies/{company_id}/applications/{application_id}/documents/{document_id}",
    response_model=DocumentMetaOut,
)
def get_application_document(
    company_id: str, application_id: str, document_id: str, db: DbDep, user: CurrentUser
) -> DocumentMetaOut:
    app = _company_app(db, company_id, application_id, user)
    doc = next((d for d in (app.documents or []) if d.id == document_id), None)
    if doc is None or (doc.status or "") == "requested":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Документ не найден")
    return DocumentMetaOut(**serialize_document(doc))


@router.get(
    "/companies/{company_id}/applications/{application_id}/documents/{document_id}/download",
)
def download_application_document(
    company_id: str, application_id: str, document_id: str, db: DbDep, user: CurrentUser
) -> Response:
    app = _company_app(db, company_id, application_id, user)
    doc = next((d for d in (app.documents or []) if d.id == document_id), None)
    if doc is None or (doc.status or "") == "requested":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Документ не найден")
    path = resolve_download_path(doc)
    if path is None:
        body = (
            f"Demo stub for document {doc.id}\n"
            f"type={doc.document_type or doc.doc_type}\n"
            f"name={doc.file_name or doc.name}\n"
        ).encode("utf-8")
        return Response(
            content=body,
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="stub-{document_id[:8]}.txt"',
            },
        )
    return FileResponse(
        path,
        filename=doc.file_name or doc.name or path.name,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.get(
    "/companies/{company_id}/applications/{application_id}/document-requests",
    response_model=list[DocumentRequestOut],
)
def list_document_requests(
    company_id: str, application_id: str, db: DbDep, user: CurrentUser
) -> list[DocumentRequestOut]:
    app = _company_app(db, company_id, application_id, user)
    reqs = sorted(
        app.document_requests or [],
        key=lambda r: r.created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return [DocumentRequestOut(**serialize_document_request(r)) for r in reqs]


@router.post(
    "/companies/{company_id}/applications/{application_id}/document-requests/{request_id}/respond",
    response_model=DocumentRequestOut,
)
def respond_to_document_request(
    company_id: str,
    application_id: str,
    request_id: str,
    body: DocumentRequestRespondIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> DocumentRequestOut:
    require_company_access(db, user, company_id, write=True)
    app = _load_app(db, application_id)
    if app.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    require_application_access(db, user, app, write=True)
    try:
        req = respond_document_request(
            db,
            app=app,
            user=user,
            request_id=request_id,
            document_ids=body.document_ids,
            comment=body.comment,
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

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
        entity_type="document_request",
        entity_id=req.id,
        action="respond",
        details={"document_ids": body.document_ids},
        correlation_id=cid,
    )
    db.commit()
    return DocumentRequestOut(**serialize_document_request(req))


# --- Legacy + analyst ---


@router.post("/applications", response_model=ApplicationOut, status_code=201, deprecated=True)
def create_application(
    body: ApplicationCreate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> ApplicationOut:
    draft = create_company_application(
        company_id=body.company_id,
        body=ApplicationDraftCreate(
            funding_need_id=body.funding_need_id,
            product_id=body.product_id,
            requested_amount=body.amount,
            term_months=body.term_months,
            rate=body.rate,
            purpose=body.purpose,
            goal_type=body.goal_type,
            currency=body.currency,
        ),
        db=db,
        user=user,
        cid=cid,
        idempotency_key=body.idempotency_key,
    )
    return ApplicationOut(**serialize_application(_load_app(db, draft.id)))


@router.get("/applications", response_model=list[ApplicationOut], deprecated=True)
def list_my_applications(db: DbDep, user: CurrentUser, company_id: str | None = None) -> list[ApplicationOut]:
    if user.role in ANALYST_ROLES:
        q = (
            select(CreditApplication)
            .options(
                joinedload(CreditApplication.documents),
                joinedload(CreditApplication.comments),
                joinedload(CreditApplication.assigned_manager),
            )
            .where(CreditApplication.status != ApplicationStatus.DRAFT)
        )
        if company_id:
            require_company_access(db, user, company_id)
            q = q.where(CreditApplication.company_id == company_id)
        apps = db.scalars(q.order_by(CreditApplication.updated_at.desc())).unique().all()
        return [ApplicationOut(**serialize_application(a)) for a in apps]

    if user.role == UserRole.ENTREPRENEUR:
        cid = resolve_company_id(db, user, company_id)
        return list_company_applications(cid, db, user)

    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")


@router.get("/applications/{application_id}", response_model=ApplicationOut, deprecated=True)
def get_application(application_id: str, db: DbDep, user: CurrentUser) -> ApplicationOut:
    app = _load_app(db, application_id)
    require_application_access(db, user, app)
    return ApplicationOut(**serialize_application(app))


@router.patch("/applications/{application_id}", response_model=ApplicationOut, deprecated=True)
def update_application(
    application_id: str, body: ApplicationUpdate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> ApplicationOut:
    app = _load_app(db, application_id)
    return patch_company_application(app.company_id, application_id, body, db, user, cid)


@router.post("/applications/{application_id}/submit", response_model=ApplicationOut, deprecated=True)
def submit_application(
    application_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApplicationOut:
    app = _load_app(db, application_id)
    submit_company_application(app.company_id, application_id, db, user, cid, idempotency_key)
    return ApplicationOut(**serialize_application(_load_app(db, application_id)))


@router.post("/applications/{application_id}/documents", response_model=ApplicationOut, deprecated=True)
async def upload_document(
    application_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    file: UploadFile = File(...),
    document_type: str = Form(default="OTHER"),
) -> ApplicationOut:
    app = _load_app(db, application_id)
    await upload_company_document(
        company_id=app.company_id,
        application_id=application_id,
        db=db,
        user=user,
        cid=cid,
        file=file,
        doc_type=document_type,
        document_request_id=None,
    )
    return ApplicationOut(**serialize_application(_load_app(db, application_id)))


@router.patch("/applications/{application_id}/status", response_model=ApplicationOut)
def change_status(
    application_id: str, body: StatusUpdate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> ApplicationOut:
    require_roles(user, UserRole.ANALYST)
    app = _load_app(db, application_id)

    if body.idempotency_key and app.status == body.status:
        return ApplicationOut(**serialize_application(app))

    if app.assigned_manager_id is None:
        app.assigned_manager_id = user.id
    if app.assigned_analyst_id is None:
        app.assigned_analyst_id = user.id

    transition_application(
        db,
        app,
        body.status,
        actor=user,
        comment=body.comment,
    )

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
    return ApplicationOut(**serialize_application(_load_app(db, app.id)))


@router.post("/applications/{application_id}/request-documents", response_model=ApplicationOut)
def request_documents(
    application_id: str, body: DocsRequestIn, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> ApplicationOut:
    require_roles(user, UserRole.ANALYST)
    app = _load_app(db, application_id)
    create_document_request(
        db,
        app=app,
        analyst=user,
        doc_type=body.document_type,
        comment=body.comment,
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
    return ApplicationOut(**serialize_application(_load_app(db, app.id)))
