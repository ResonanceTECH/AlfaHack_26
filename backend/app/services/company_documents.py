from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.errors import AppError
from app.models.company import CompanyDocument
from app.models.user import User
from app.services.documents import resolve_download_path, validate_upload
from fastapi import status as http_status


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_document(doc: CompanyDocument) -> dict[str, Any]:
    return {
        "id": doc.id,
        "company_id": doc.company_id,
        "title": doc.title,
        "category": doc.category,
        "status": doc.status,
        "file_name": doc.file_name,
        "mime_type": doc.mime_type,
        "size_bytes": doc.size_bytes,
        "uploaded_by": doc.uploaded_by,
        "uploaded_at": doc.uploaded_at,
        "review_comment": doc.review_comment,
        "created_at": doc.created_at,
    }


def list_documents(
    db: Session,
    company_id: str,
    *,
    category: str | None = None,
    status: str | None = None,
    q: str | None = None,
) -> list[CompanyDocument]:
    stmt = select(CompanyDocument).where(CompanyDocument.company_id == company_id)
    if category:
        stmt = stmt.where(CompanyDocument.category == category)
    if status:
        stmt = stmt.where(CompanyDocument.status == status.strip().upper())
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(CompanyDocument.title.ilike(like), CompanyDocument.file_name.ilike(like))
        )
    return list(db.scalars(stmt.order_by(CompanyDocument.created_at.desc())).all())


def get_document(db: Session, company_id: str, doc_id: str) -> CompanyDocument | None:
    doc = db.get(CompanyDocument, doc_id)
    if doc is None or doc.company_id != company_id:
        return None
    return doc


def store_company_file(company_id: str, filename: str | None, content: bytes) -> Path:
    settings = get_settings()
    upload_dir = Path(settings.upload_dir) / "companies" / company_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(filename or "file.bin").suffix
    path = upload_dir / f"{uuid4().hex}{ext}"
    path.write_bytes(content)
    return path


def create_document(
    db: Session,
    *,
    company_id: str,
    user: User,
    title: str,
    category: str,
    content: bytes | None,
    filename: str | None,
    content_type: str | None,
) -> CompanyDocument:
    title_norm = (title or "").strip() or (filename or "Документ")
    category_norm = (category or "").strip() or "Прочее"
    doc = CompanyDocument(
        company_id=company_id,
        title=title_norm,
        category=category_norm,
        status="NEED_UPLOAD",
    )
    if content:
        validate_upload(filename, content, content_type)
        path = store_company_file(company_id, filename, content)
        doc.file_name = filename or path.name
        doc.file_path = str(path)
        doc.mime_type = content_type
        doc.size_bytes = len(content)
        doc.uploaded_by = user.id
        doc.uploaded_at = utcnow()
        doc.status = "PENDING"
    db.add(doc)
    db.flush()
    return doc


def delete_document(db: Session, doc: CompanyDocument) -> None:
    path = resolve_download_path(doc)  # type: ignore[arg-type]
    if path is not None:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
    db.delete(doc)
    db.flush()


def require_document(db: Session, company_id: str, doc_id: str) -> CompanyDocument:
    doc = get_document(db, company_id, doc_id)
    if doc is None:
        raise AppError("NOT_FOUND", "Документ не найден", status_code=http_status.HTTP_404_NOT_FOUND)
    return doc
