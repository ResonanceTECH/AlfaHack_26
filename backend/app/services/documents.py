from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import status as http_status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.enums import ApplicationStatus
from app.core.errors import AppError
from app.models.application import ApplicationDocument, CreditApplication, DocumentRequest
from app.models.credit import CreditProduct
from app.models.user import User
from app.services.notifications import notify
from app.services.workflow import transition_application

# Статусы, из которых аналитик может запросить документы
DOCS_REQUEST_ALLOWED: set[ApplicationStatus] = {
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.VALIDATING,
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.DOCS_REQUESTED,
    ApplicationStatus.COUNTEROFFERED,
}

DEFAULT_REQUIRED_DOCS = [
    "PASSPORT",
    "EGRIP_EXTRACT",
    "BANK_STATEMENT_6M",
]

DOC_LABELS: dict[str, str] = {
    "PASSPORT": "Паспорт",
    "EGRIP_EXTRACT": "Выписка ЕГРИП",
    "BANK_STATEMENT_6M": "Банковская выписка 6 мес.",
    "FINANCIAL_STATEMENTS": "Финансовая отчётность",
    "OTHER": "Прочее",
}

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".xls", ".xlsx"}


def _normalize_doc_type(item: str) -> str:
    key = str(item).strip()
    if not key:
        return "OTHER"
    if key in DOC_LABELS:
        return key
    # человекочитаемая метка из seed → стабильный код + label
    code = "".join(ch if ch.isalnum() else "_" for ch in key.upper()).strip("_")[:64] or "OTHER"
    while "__" in code:
        code = code.replace("__", "_")
    DOC_LABELS.setdefault(code, key)
    return code


def required_doc_types(db: Session, app: CreditApplication) -> list[str]:
    product = db.get(CreditProduct, app.product_id) if app.product_id else None
    raw = list(product.documents) if product and product.documents else DEFAULT_REQUIRED_DOCS
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        code = _normalize_doc_type(str(item))
        if code not in seen:
            seen.add(code)
            out.append(code)
    return out or list(DEFAULT_REQUIRED_DOCS)


def doc_label(doc_type: str) -> str:
    return DOC_LABELS.get(doc_type, doc_type)


def serialize_document(doc: ApplicationDocument) -> dict[str, Any]:
    dtype = doc.document_type or doc.doc_type or "OTHER"
    return {
        "id": doc.id,
        "doc_type": dtype,
        "type": dtype,
        "name": doc.name or doc.file_name or "",
        "file_name": doc.file_name or doc.name,
        "size": int(doc.size or doc.size_bytes or 0),
        "mime_type": doc.mime_type,
        "status": doc.status or "uploaded",
        "uploaded_at": doc.uploaded_at,
        "review_status": "PENDING" if (doc.status or "") == "uploaded" else (doc.status or "PENDING").upper(),
    }


def serialize_document_request(req: DocumentRequest) -> dict[str, Any]:
    return {
        "id": req.id,
        "doc_type": req.doc_type,
        "label": doc_label(req.doc_type),
        "comment": req.comment,
        "status": req.status,
        "due_at": req.due_at,
        "created_at": req.created_at,
        "satisfied_document_id": req.satisfied_document_id,
    }


def list_documents_bundle(db: Session, app: CreditApplication) -> dict[str, Any]:
    docs = [d for d in (app.documents or []) if (d.status or "") != "requested"]
    placeholders = [d for d in (app.documents or []) if (d.status or "") == "requested"]
    uploaded_by_type: dict[str, ApplicationDocument] = {}
    for d in docs:
        key = d.document_type or d.doc_type
        if key and key not in uploaded_by_type:
            uploaded_by_type[key] = d

    required_slots: list[dict[str, Any]] = []
    for dtype in required_doc_types(db, app):
        uploaded = uploaded_by_type.get(dtype)
        requested = next((p for p in placeholders if (p.document_type or p.doc_type) == dtype), None)
        if uploaded:
            status = "UPLOADED"
            doc_id = uploaded.id
        elif requested:
            status = "REQUESTED"
            doc_id = requested.id
        else:
            status = "MISSING"
            doc_id = None
        required_slots.append(
            {
                "doc_type": dtype,
                "label": doc_label(dtype),
                "required": True,
                "status": status,
                "document_id": doc_id,
            }
        )

    return {
        "application_id": app.id,
        "required": required_slots,
        "documents": [serialize_document(d) for d in docs],
    }


def validate_upload(filename: str | None, content: bytes, content_type: str | None) -> None:
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(f"Файл больше {settings.max_upload_mb} МБ")
    if len(content) == 0:
        raise ValueError("Пустой файл")
    ext = Path(filename or "file.bin").suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Недопустимое расширение: {ext}")
    _ = content_type  # mime не блокируем — ориентируемся на расширение


def store_file(application_id: str, filename: str | None, content: bytes) -> tuple[Path, str]:
    settings = get_settings()
    upload_dir = Path(settings.upload_dir) / "applications" / application_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(filename or "file.bin").suffix
    key = f"{uuid4().hex}{ext}"
    path = upload_dir / key
    path.write_bytes(content)
    return path, key


def upload_document(
    db: Session,
    *,
    app: CreditApplication,
    user: User,
    content: bytes,
    filename: str | None,
    content_type: str | None,
    doc_type: str,
    document_request_id: str | None = None,
) -> ApplicationDocument:
    validate_upload(filename, content, content_type)
    path, _key = store_file(app.id, filename, content)
    dtype = (doc_type or "OTHER").strip() or "OTHER"

    req: DocumentRequest | None = None
    if document_request_id:
        req = next((r for r in (app.document_requests or []) if r.id == document_request_id), None)
        if req is None:
            raise LookupError("Запрос документа не найден")
        if req.status not in ("OPEN", "PENDING", "requested"):
            raise ValueError("Запрос документа уже закрыт")
        dtype = req.doc_type or dtype

    # Закрыть placeholder / open request того же типа
    requested_doc = next(
        (
            d
            for d in (app.documents or [])
            if (d.document_type or d.doc_type) == dtype and d.status == "requested"
        ),
        None,
    )
    if requested_doc:
        requested_doc.name = filename or requested_doc.name
        requested_doc.file_name = filename or requested_doc.file_name
        requested_doc.file_path = str(path)
        requested_doc.mime_type = content_type
        requested_doc.size = len(content)
        requested_doc.size_bytes = len(content)
        requested_doc.status = "uploaded"
        requested_doc.uploaded_by = user.id
        doc = requested_doc
    else:
        doc = ApplicationDocument(
            application_id=app.id,
            doc_type=dtype,
            document_type=dtype,
            name=filename or path.name,
            file_name=filename or path.name,
            file_path=str(path),
            mime_type=content_type,
            size=len(content),
            size_bytes=len(content),
            status="uploaded",
            uploaded_by=user.id,
        )
        db.add(doc)
        db.flush()

    if req is None:
        req = next(
            (
                r
                for r in (app.document_requests or [])
                if r.doc_type == dtype and r.status in ("OPEN", "PENDING", "requested")
            ),
            None,
        )
    if req is not None:
        req.status = "SATISFIED"
        req.satisfied_document_id = doc.id

    open_reqs = [
        r
        for r in (app.document_requests or [])
        if r.status in ("OPEN", "PENDING", "requested")
    ]
    if app.status == ApplicationStatus.DOCS_REQUESTED and not open_reqs:
        transition_application(
            db,
            app,
            ApplicationStatus.IN_REVIEW,
            actor=user,
            comment="Документы загружены",
        )

    db.flush()

    # Keep analyst auto-check in sync with live uploads
    from app.services.workflow import refresh_documents_baseline_check

    refresh_documents_baseline_check(db, app)

    analyst_id = app.assigned_analyst_id or app.assigned_manager_id
    if analyst_id and analyst_id != user.id:
        from app.services.notifications import notify

        label = filename or doc.file_name or doc.name or "файл"
        notify(
            db,
            user_id=analyst_id,
            type="APP_DOC_UPLOADED",
            title="Клиент загрузил документ",
            body=f"«{label}» по заявке {app.id[:8]}… — смотрите «Проверки» / «Документы».",
            payload={
                "application_id": app.id,
                "document_id": doc.id,
                "file_name": label,
                "doc_type": doc.document_type or doc.doc_type,
                "company_id": app.company_id,
            },
        )

    db.flush()
    return doc


def respond_document_request(
    db: Session,
    *,
    app: CreditApplication,
    user: User,
    request_id: str,
    document_ids: list[str],
    comment: str | None,
) -> DocumentRequest:
    req = next((r for r in (app.document_requests or []) if r.id == request_id), None)
    if req is None:
        raise LookupError("Запрос документа не найден")
    if req.status not in ("OPEN", "PENDING", "requested"):
        raise ValueError("Запрос документа уже закрыт")

    docs = {d.id: d for d in (app.documents or [])}
    linked: ApplicationDocument | None = None
    for did in document_ids:
        d = docs.get(did)
        if d is None:
            raise LookupError(f"Документ {did} не найден в заявке")
        linked = d

    if linked is None:
        raise ValueError("Нужно указать хотя бы один document_id")

    req.status = "SATISFIED"
    req.satisfied_document_id = linked.id
    if comment:
        ctx_comment = comment
    else:
        ctx_comment = None
    _ = ctx_comment  # comment фиксируется на уровне API как ApplicationComment

    open_reqs = [
        r
        for r in (app.document_requests or [])
        if r.status in ("OPEN", "PENDING", "requested") and r.id != req.id
    ]
    if app.status == ApplicationStatus.DOCS_REQUESTED and not open_reqs:
        transition_application(
            db,
            app,
            ApplicationStatus.IN_REVIEW,
            actor=user,
            comment="Ответ на запрос документов",
        )
    db.flush()
    return req


def create_document_request(
    db: Session,
    *,
    app: CreditApplication,
    analyst: User,
    doc_type: str,
    comment: str | None,
    due_at: datetime | None = None,
) -> DocumentRequest:
    dtype = (doc_type or "").strip()
    if not dtype:
        raise AppError(
            "VALIDATION_ERROR",
            "doc_type обязателен",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            fields=[{"field": "doc_type", "code": "REQUIRED"}],
        )

    if app.status not in DOCS_REQUEST_ALLOWED:
        raise AppError(
            "INVALID_TRANSITION",
            f"Нельзя запросить документы из статуса {app.status.value}",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "status", "code": app.status.value}],
        )

    open_same = next(
        (
            r
            for r in (app.document_requests or [])
            if r.doc_type == dtype and (r.status or "").upper() in ("OPEN", "PENDING", "REQUESTED")
        ),
        None,
    )
    if open_same is not None:
        raise AppError(
            "DUPLICATE_DOCUMENT_REQUEST",
            f"Уже есть открытый запрос на тип «{dtype}»",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "doc_type", "code": "DUPLICATE"}],
        )

    if due_at is None:
        due_at = datetime.now(timezone.utc) + timedelta(days=7)

    if app.assigned_analyst_id is None:
        app.assigned_analyst_id = analyst.id
    if app.assigned_manager_id is None:
        app.assigned_manager_id = analyst.id

    req = DocumentRequest(
        application_id=app.id,
        requested_by=analyst.id,
        doc_type=dtype,
        comment=comment,
        status="OPEN",
        due_at=due_at,
    )
    db.add(req)
    placeholder = ApplicationDocument(
        application_id=app.id,
        doc_type=dtype,
        document_type=dtype,
        name=f"Запрошено: {doc_label(dtype)}",
        file_name=f"Запрошено: {doc_label(dtype)}",
        file_path="",
        size=0,
        status="requested",
        uploaded_by=analyst.id,
    )
    db.add(placeholder)
    if app.status != ApplicationStatus.DOCS_REQUESTED:
        transition_application(
            db,
            app,
            ApplicationStatus.DOCS_REQUESTED,
            actor=analyst,
            comment=comment or f"Запрошен документ: {dtype}",
        )
    db.flush()
    if app.document_requests is None:
        app.document_requests = [req]
    else:
        app.document_requests.append(req)
    if app.documents is None:
        app.documents = [placeholder]
    else:
        app.documents.append(placeholder)

    if app.created_by:
        notify(
            db,
            user_id=app.created_by,
            type="DOCUMENTS_REQUESTED",
            title="Запрошены дополнительные документы",
            body=comment or f"Нужен документ: {doc_label(dtype)}",
            payload={
                "application_id": app.id,
                "company_id": app.company_id,
                "document_request_id": req.id,
                "doc_type": dtype,
            },
        )
    return req


def cancel_document_request(
    db: Session,
    *,
    app: CreditApplication,
    analyst: User,
    request_id: str,
    reason: str | None = None,
) -> DocumentRequest:
    req = next((r for r in (app.document_requests or []) if r.id == request_id), None)
    if req is None:
        raise AppError(
            "NOT_FOUND",
            "Запрос документа не найден",
            status_code=http_status.HTTP_404_NOT_FOUND,
        )
    if (req.status or "").upper() not in ("OPEN", "PENDING", "REQUESTED"):
        raise AppError(
            "REQUEST_NOT_OPEN",
            f"Запрос уже закрыт (статус {req.status})",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    req.status = "CANCELLED"
    if reason:
        # comment append
        prev = (req.comment or "").strip()
        req.comment = f"{prev}\n[cancelled] {reason}".strip() if prev else f"[cancelled] {reason}"

    # снять placeholder requested
    for d in app.documents or []:
        if (
            (d.document_type or d.doc_type) == req.doc_type
            and (d.status or "") == "requested"
            and not d.file_path
        ):
            d.status = "cancelled"

    open_left = [
        r
        for r in (app.document_requests or [])
        if r.id != req.id and (r.status or "").upper() in ("OPEN", "PENDING", "REQUESTED")
    ]
    if app.status == ApplicationStatus.DOCS_REQUESTED and not open_left:
        transition_application(
            db,
            app,
            ApplicationStatus.IN_REVIEW,
            actor=analyst,
            comment=reason or "Запрос документов отменён",
        )
    db.flush()
    return req


def resolve_download_path(doc: ApplicationDocument) -> Path | None:
    if not doc.file_path:
        return None
    path = Path(doc.file_path)
    if path.is_file():
        return path
    return None
