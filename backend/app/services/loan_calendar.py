"""Seed loan payment schedule into company calendar + first-payment notification."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import OfferStatus
from app.models.application import CreditApplication
from app.models.company import CompanyMembership
from app.models.decision import CreditOffer
from app.models.finance import FinancialObligation
from app.services.finance_engine import build_payment_schedule
from app.services.notifications import notify


def _first_repayment_date(today: date | None = None) -> date:
    """First payment ≈ 1 month from now (demo: next month, same day clamped)."""
    today = today or date.today()
    month = today.month + 1
    year = today.year
    if month > 12:
        month = 1
        year += 1
    day = min(today.day, 28)
    return date(year, month, day)


def _money(v: Any) -> Decimal:
    return Decimal(str(v or 0))


def _already_seeded(db: Session, *, company_id: str, application_id: str) -> bool:
    rows = db.scalars(
        select(FinancialObligation).where(FinancialObligation.company_id == company_id)
    ).all()
    for ob in rows:
        meta = ob.meta or {}
        if (
            meta.get("source") == "loan_schedule"
            and meta.get("application_id") == application_id
        ):
            return True
    return False


def _format_rub(amount: Decimal) -> str:
    return f"{float(amount):,.0f} ₽".replace(",", " ")


def _format_ru_date(d: date) -> str:
    months = (
        "",
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    )
    return f"{d.day} {months[d.month]} {d.year}"


def seed_loan_schedule_obligations(
    db: Session,
    *,
    app: CreditApplication,
    offer: CreditOffer | None = None,
    notify_user_ids: list[str] | None = None,
    start_date: date | None = None,
) -> list[FinancialObligation]:
    """
    Create type=loan calendar obligations from accepted offer schedule.
    Idempotent per application_id. Sends one CREDIT_FIRST_PAYMENT notification.
    """
    if not app.company_id:
        return []

    if offer is None:
        offer = db.scalar(
            select(CreditOffer).where(
                CreditOffer.application_id == app.id,
                CreditOffer.status == OfferStatus.ACCEPTED,
            )
        )
    if offer is None:
        # fallback: active offer (APPROVED but not yet accepted) — skip
        return []

    if _already_seeded(db, company_id=app.company_id, application_id=app.id):
        return []

    amount = _money(offer.amount)
    term = int(offer.term_months or app.term_months or 12)
    rate = _money(offer.rate if offer.rate is not None else app.rate)
    if amount <= 0 or term <= 0:
        return []

    schedule_type = str((offer.conditions or {}).get("schedule_type") or "annuity")
    start = start_date or _first_repayment_date()
    schedule = build_payment_schedule(
        amount=amount,
        term_months=term,
        annual_rate=rate,
        schedule_type=schedule_type,
        start_date=start,
    )
    product = (app.product_name or "Кредит").strip()
    created: list[FinancialObligation] = []

    for row in schedule["rows"]:
        due: date = row["date"]
        pay = _money(row["payment"])
        month_i = int(row["month"])
        title = f"Платёж по кредиту «{product}» · {month_i}/{term}"
        ob = FinancialObligation(
            company_id=app.company_id,
            type="loan",
            title=title,
            creditor="Альфа-Банк (демо)",
            amount=pay,
            remaining=pay,
            rate=rate,
            due_date=due,
            recurring=False,
            status="planned",
            meta={
                "source": "loan_schedule",
                "application_id": app.id,
                "offer_id": offer.id,
                "payment_month": month_i,
                "currency": offer.currency or "RUB",
                "product_name": product,
            },
        )
        db.add(ob)
        created.append(ob)

    db.flush()

    if not created:
        return []

    first = created[0]
    first_due = first.due_date
    assert first_due is not None
    body = (
        f"Кредит одобрен и принят. Первый платёж — {_format_ru_date(first_due)} "
        f"на сумму {_format_rub(_money(first.amount))} по продукту «{product}». "
        f"График из {term} платежей добавлен в календарь."
    )

    recipients: set[str] = set(notify_user_ids or [])
    if app.created_by:
        recipients.add(app.created_by)
    for m in db.scalars(
        select(CompanyMembership).where(CompanyMembership.company_id == app.company_id)
    ).all():
        recipients.add(m.user_id)

    from app.models.notification import Notification

    for uid in recipients:
        # dedupe: one CREDIT_FIRST_PAYMENT per application per user
        prior = db.scalars(
            select(Notification).where(
                Notification.user_id == uid,
                Notification.type == "CREDIT_FIRST_PAYMENT",
            )
        ).all()
        if any((n.payload or {}).get("application_id") == app.id for n in prior):
            continue
        notify(
            db,
            user_id=uid,
            type="CREDIT_FIRST_PAYMENT",
            title="Первый платёж по одобренному кредиту",
            body=body,
            payload={
                "application_id": app.id,
                "offer_id": offer.id,
                "company_id": app.company_id,
                "due_date": first_due.isoformat(),
                "amount": float(first.amount),
                "obligation_id": first.id,
                "product_name": product,
            },
        )

    return created


def ensure_loan_schedule_for_app(db: Session, app: CreditApplication) -> list[FinancialObligation]:
    """Backfill schedule if offer already accepted / agreement stage."""
    return seed_loan_schedule_obligations(db, app=app)


def sync_company_accepted_loan_schedules(db: Session, *, company_id: str) -> int:
    """Ensure all accepted-offer apps for company have calendar rows."""
    apps = list(
        db.scalars(
            select(CreditApplication).where(CreditApplication.company_id == company_id)
        ).all()
    )
    n = 0
    for app in apps:
        created = ensure_loan_schedule_for_app(db, app)
        n += len(created)
    return n
