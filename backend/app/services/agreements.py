from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ApplicationStatus, MemberRole, OfferStatus
from app.core.errors import AppError
from app.models.agreement import Agreement, AgreementConfirmation
from app.models.application import CreditApplication
from app.models.company import CompanyMembership
from app.models.decision import CreditOffer
from app.models.doc_review import DocumentReview
from app.models.user import User
from app.services.notifications import notify

DEMO_PDF_PATH = Path(__file__).resolve().parent.parent / "static" / "agreement_demo.pdf"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _accepted_offer(db: Session, app: CreditApplication) -> CreditOffer | None:
    return db.scalar(
        select(CreditOffer).where(
            CreditOffer.application_id == app.id,
            CreditOffer.status == OfferStatus.ACCEPTED,
        )
    )


def ensure_agreement(db: Session, app: CreditApplication) -> Agreement:
    from app.services.loan_calendar import ensure_loan_schedule_for_app

    existing = db.scalar(
        select(Agreement)
        .options(joinedload(Agreement.confirmation))
        .where(Agreement.application_id == app.id)
    )
    if existing is not None:
        ensure_loan_schedule_for_app(db, app)
        return existing

    if app.status not in (
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.AGREEMENT_PREPARATION,
        ApplicationStatus.ISSUED,
        ApplicationStatus.APPROVED,
        ApplicationStatus.COUNTEROFFERED,
    ):
        offer = _accepted_offer(db, app)
        if offer is None:
            raise AppError(
                "NO_ACCEPTED_OFFER",
                "Договор доступен после принятия предложения",
                status_code=http_status.HTTP_409_CONFLICT,
            )
    else:
        offer = _accepted_offer(db, app)

    amount = Decimal(str(offer.amount)) if offer else Decimal(str(app.amount or 0))
    term = offer.term_months if offer else (app.term_months or 12)
    rate = Decimal(str(offer.rate)) if offer else Decimal(str(app.rate or 0))

    agreement = Agreement(
        application_id=app.id,
        offer_id=offer.id if offer else None,
        company_id=app.company_id,
        number=f"DEMO-{app.id[:8].upper()}",
        status="READY",
        amount=amount,
        term_months=term,
        rate=rate,
        document_path=str(DEMO_PDF_PATH) if DEMO_PDF_PATH.is_file() else None,
        meta={"demo": True, "pdf_stub": False},
    )
    db.add(agreement)
    db.flush()
    ensure_loan_schedule_for_app(db, app)
    return agreement


def _helper_reviews(db: Session, agreement: Agreement) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(DocumentReview)
            .options(joinedload(DocumentReview.assignee))
            .where(
                DocumentReview.application_id == agreement.application_id,
                DocumentReview.kind == "agreement",
            )
            .order_by(DocumentReview.created_at.desc())
        ).all()
    )
    out: list[dict[str, Any]] = []
    for r in rows:
        assignee = getattr(r, "assignee", None)
        out.append(
            {
                "id": r.id,
                "assignee_user_id": r.assignee_user_id,
                "assignee_name": assignee.full_name if assignee else None,
                "status": r.status,
                "purpose": r.purpose,
                "comment": r.comment,
                "updated_at": r.updated_at,
            }
        )
    return out


def serialize_agreement(db: Session | None, agreement: Agreement) -> dict[str, Any]:
    conf = agreement.confirmation
    meta = agreement.meta or {}
    helpers: list[dict[str, Any]] = []
    if db is not None:
        helpers = _helper_reviews(db, agreement)
    helper_ok = any((h.get("status") or "").lower() == "approved" for h in helpers)
    return {
        "id": agreement.id,
        "application_id": agreement.application_id,
        "offer_id": agreement.offer_id,
        "company_id": agreement.company_id,
        "number": agreement.number,
        "status": agreement.status,
        "amount": agreement.amount,
        "term_months": agreement.term_months,
        "rate": agreement.rate,
        "confirmed": conf is not None,
        "confirmed_at": conf.confirmed_at if conf else None,
        "document_ready": True,
        "sent_at": meta.get("sent_at"),
        "sent_by": meta.get("sent_by"),
        "helper_approved": helper_ok,
        "helper_reviews": helpers,
        "disclaimer": "Демонстрационный договор, не имеет юридической силы.",
    }


def is_company_owner(db: Session, company_id: str, user_id: str) -> bool:
    m = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    return m is not None and m.role == MemberRole.OWNER


def send_agreement_to_client(
    db: Session,
    agreement: Agreement,
    *,
    actor: User,
) -> Agreement:
    if agreement.confirmation is not None or (agreement.status or "").upper() == "CONFIRMED":
        raise AppError(
            "ALREADY_CONFIRMED",
            "Договор уже согласован владельцем",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    meta = dict(agreement.meta or {})
    meta["sent_at"] = utcnow().isoformat()
    meta["sent_by"] = actor.id
    agreement.meta = meta
    agreement.status = "SENT_TO_CLIENT"

    app = db.get(CreditApplication, agreement.application_id)
    if app and app.status in (ApplicationStatus.OFFER_ACCEPTED, ApplicationStatus.APPROVED):
        app.status = ApplicationStatus.AGREEMENT_PREPARATION
        app.current_step = "AGREEMENT"

    owners = list(
        db.scalars(
            select(CompanyMembership).where(
                CompanyMembership.company_id == agreement.company_id,
                CompanyMembership.role == MemberRole.OWNER,
            )
        ).all()
    )
    label = agreement.number or agreement.id[:8]
    for m in owners:
        if m.user_id == actor.id:
            continue
        notify(
            db,
            user_id=m.user_id,
            type="AGREEMENT_SENT",
            title="Договор на согласование",
            body=(
                f"Банк отправил демо-договор {label}. Можно назначить сотрудника на разбор, "
                "финальное одобрение — за владельцем."
            ),
            payload={
                "application_id": agreement.application_id,
                "agreement_id": agreement.id,
                "company_id": agreement.company_id,
            },
        )
    # also notify application creator if not owner-notified
    if app and app.created_by and app.created_by not in {m.user_id for m in owners}:
        notify(
            db,
            user_id=app.created_by,
            type="AGREEMENT_SENT",
            title="Договор на согласование",
            body=f"Банк отправил демо-договор {label} по заявке.",
            payload={
                "application_id": agreement.application_id,
                "agreement_id": agreement.id,
                "company_id": agreement.company_id,
            },
        )

    db.flush()
    return agreement


def confirm_agreement(
    db: Session,
    agreement: Agreement,
    *,
    actor: User,
    note: str | None,
    require_owner: bool = True,
) -> AgreementConfirmation:
    if agreement.confirmation is not None:
        raise AppError(
            "ALREADY_CONFIRMED",
            "Ознакомление уже зафиксировано",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    if require_owner and not is_company_owner(db, agreement.company_id, actor.id):
        raise AppError(
            "OWNER_REQUIRED",
            "Финальное согласование договора выполняет только владелец компании. "
            "Назначенный сотрудник может лишь дать рекомендацию.",
            status_code=http_status.HTTP_403_FORBIDDEN,
        )

    conf = AgreementConfirmation(
        agreement_id=agreement.id,
        confirmed_by=actor.id,
        confirmed_at=utcnow(),
        meta={"note": note, "demo": True},
    )
    db.add(conf)
    agreement.status = "CONFIRMED"
    meta = dict(agreement.meta or {})
    meta["owner_confirmed_at"] = utcnow().isoformat()
    agreement.meta = meta

    app = db.get(CreditApplication, agreement.application_id)
    if app and app.status in (
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.AGREEMENT_PREPARATION,
    ):
        app.status = ApplicationStatus.AGREEMENT_PREPARATION
        app.current_step = "AGREEMENT_CONFIRMED"

    # notify assigned analyst
    if app and (app.assigned_analyst_id or app.assigned_manager_id):
        aid = app.assigned_analyst_id or app.assigned_manager_id
        if aid and aid != actor.id:
            notify(
                db,
                user_id=aid,
                type="AGREEMENT_CONFIRMED",
                title="Договор согласован владельцем",
                body=f"Владелец подтвердил договор {agreement.number or agreement.id[:8]}.",
                payload={
                    "application_id": agreement.application_id,
                    "agreement_id": agreement.id,
                    "company_id": agreement.company_id,
                },
            )

    db.flush()
    return conf


def pdf_bytes(agreement: Agreement) -> bytes:
    path = DEMO_PDF_PATH
    if agreement.document_path:
        p = Path(agreement.document_path)
        if p.is_file():
            path = p
    if path.is_file():
        return path.read_bytes()
    # fallback text stub
    lines = [
        "%PDF-1.1",
        "1 0 obj<<>>endobj",
        "DEMO AGREEMENT (not a real PDF binary — text stub for hackathon)",
        f"Number: {agreement.number}",
        f"Application: {agreement.application_id}",
        f"Amount: {agreement.amount}",
        f"Term: {agreement.term_months} months",
        f"Rate: {agreement.rate}%",
        "This document has no legal force.",
        "%%EOF",
    ]
    return "\n".join(lines).encode("utf-8")


# backward-compat alias
def pdf_stub_bytes(agreement: Agreement) -> bytes:
    return pdf_bytes(agreement)
