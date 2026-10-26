"""In-app reminders for upcoming obligations based on company calendar_settings."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company, CompanyMembership
from app.models.finance import FinancialObligation
from app.models.notification import Notification
from app.services.calendar_ics import merge_reminder_settings
from app.services.notifications import notify


def get_company_reminder_settings(company: Company) -> dict[str, Any]:
    return merge_reminder_settings(getattr(company, "calendar_settings", None) or {})


def save_company_reminder_settings(
    company: Company, patch: dict[str, Any]
) -> dict[str, Any]:
    current = get_company_reminder_settings(company)
    merged = dict(current)
    for key in ("enabled", "days_before", "channels", "types"):
        if key in patch and patch[key] is not None:
            merged[key] = patch[key]
    merged = merge_reminder_settings(merged)
    company.calendar_settings = merged
    return merged


def _already_notified(
    db: Session, *, user_id: str, obligation_id: str, day: date, days_before: int
) -> bool:
    key = f"{obligation_id}:{day.isoformat()}:D{days_before}"
    rows = db.scalars(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == "OBLIGATION_DUE",
        )
    ).all()
    for n in rows:
        payload = n.payload or {}
        if payload.get("dedupe_key") == key:
            return True
    return False


def dispatch_obligation_reminders(
    db: Session,
    *,
    company_id: str,
    today: date | None = None,
) -> int:
    """Create IN_APP notifications for members when an obligation is N days away."""
    company = db.get(Company, company_id)
    if company is None:
        return 0
    settings = get_company_reminder_settings(company)
    if not settings.get("enabled"):
        return 0
    channels = {str(c).upper() for c in settings.get("channels") or []}
    if "IN_APP" not in channels:
        return 0
    days_list = [int(d) for d in settings.get("days_before") or []]
    type_set = {str(t).lower() for t in settings.get("types") or []}
    today = today or date.today()

    members = list(
        db.scalars(
            select(CompanyMembership).where(CompanyMembership.company_id == company_id)
        ).all()
    )
    if not members:
        return 0

    obligations = list(
        db.scalars(
            select(FinancialObligation).where(
                FinancialObligation.company_id == company_id,
            )
        ).all()
    )
    created = 0
    for ob in obligations:
        if ob.due_date is None:
            continue
        st = (ob.status or "").lower()
        if st in {"paid", "cancelled", "canceled"}:
            continue
        if type_set and ob.type and ob.type.lower() not in type_set:
            # allow unknown types through if "other" selected
            if "other" not in type_set:
                continue
        for days_before in days_list:
            target = today + timedelta(days=days_before)
            if ob.due_date != target:
                continue
            title = (ob.title or ob.type or "Платёж").strip()
            body = (
                f"Через {days_before} дн."
                if days_before > 0
                else "Сегодня"
            ) + f" — {title}"
            if ob.amount is not None:
                body += f" · {float(ob.amount):,.0f} ₽".replace(",", " ")
            for m in members:
                dedupe = f"{ob.id}:{ob.due_date.isoformat()}:D{days_before}"
                if _already_notified(
                    db,
                    user_id=m.user_id,
                    obligation_id=ob.id,
                    day=ob.due_date,
                    days_before=days_before,
                ):
                    continue
                notify(
                    db,
                    user_id=m.user_id,
                    type="OBLIGATION_DUE",
                    title="Напоминание о платеже",
                    body=body,
                    payload={
                        "obligation_id": ob.id,
                        "company_id": company_id,
                        "due_date": ob.due_date.isoformat(),
                        "days_before": days_before,
                        "dedupe_key": dedupe,
                    },
                    channel="IN_APP",
                )
                created += 1
    return created
