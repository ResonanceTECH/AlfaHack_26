from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ApplicationStatus, OfferStatus
from app.core.errors import AppError
from app.models.agreement import Agreement, AgreementConfirmation
from app.models.application import CreditApplication
from app.models.decision import CreditOffer


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
    ):
        # allow if there's an accepted offer anyway
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
        document_path=None,
        meta={"demo": True, "pdf_stub": True},
    )
    db.add(agreement)
    db.flush()
    ensure_loan_schedule_for_app(db, app)
    return agreement


def serialize_agreement(agreement: Agreement) -> dict[str, Any]:
    conf = agreement.confirmation
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
        "disclaimer": "Демонстрационный договор, не имеет юридической силы.",
    }


def confirm_agreement(
    db: Session, agreement: Agreement, *, actor_id: str | None, note: str | None
) -> AgreementConfirmation:
    if agreement.confirmation is not None:
        raise AppError(
            "ALREADY_CONFIRMED",
            "Ознакомление уже зафиксировано",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    conf = AgreementConfirmation(
        agreement_id=agreement.id,
        confirmed_by=actor_id,
        confirmed_at=utcnow(),
        meta={"note": note, "demo": True},
    )
    db.add(conf)
    agreement.status = "CONFIRMED"
    app = db.get(CreditApplication, agreement.application_id)
    if app and app.status == ApplicationStatus.OFFER_ACCEPTED:
        app.status = ApplicationStatus.AGREEMENT_PREPARATION
    db.flush()
    return conf


def pdf_stub_bytes(agreement: Agreement) -> bytes:
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
