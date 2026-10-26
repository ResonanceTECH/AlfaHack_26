"""RFC 5545 .ics export for company calendar (obligations)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterable

from app.models.finance import FinancialObligation


def _fold(line: str) -> str:
    """Fold long lines at 75 octets (approx chars for ASCII ICS)."""
    if len(line) <= 75:
        return line
    parts: list[str] = []
    while len(line) > 75:
        parts.append(line[:75])
        line = " " + line[75:]
    parts.append(line)
    return "\r\n".join(parts)


def escape_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def format_date(d: date) -> str:
    return d.strftime("%Y%m%d")


def format_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def money_desc(amount: Decimal | float | int | None, currency: str = "RUB") -> str:
    if amount is None:
        return ""
    n = float(amount)
    if currency.upper() == "RUB":
        return f"{n:,.0f} ₽".replace(",", " ")
    return f"{n:,.2f} {currency}"


def build_vevent(
    *,
    uid: str,
    summary: str,
    due: date,
    description: str = "",
    stamp: datetime | None = None,
    alarm_days: Iterable[int] = (),
    recurring: bool = False,
) -> list[str]:
    stamp = stamp or datetime.now(timezone.utc)
    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{format_utc(stamp)}",
        f"DTSTART;VALUE=DATE:{format_date(due)}",
        f"DTEND;VALUE=DATE:{format_date(due)}",
        f"SUMMARY:{escape_text(summary)}",
    ]
    if description:
        lines.append(f"DESCRIPTION:{escape_text(description)}")
    if recurring:
        lines.append("RRULE:FREQ=MONTHLY")
    for days in sorted({int(d) for d in alarm_days if int(d) >= 0}, reverse=True):
        trigger = f"-P{days}D" if days > 0 else "-PT9H"
        lines.extend(
            [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                f"TRIGGER:{trigger}",
                f"DESCRIPTION:{escape_text(summary)}",
                "END:VALARM",
            ]
        )
    lines.append("END:VEVENT")
    return lines


def serialize_obligation_event(
    ob: FinancialObligation,
    *,
    alarm_days: Iterable[int] = (),
    stamp: datetime | None = None,
) -> list[str] | None:
    if ob.due_date is None:
        return None
    status = (ob.status or "").upper()
    if status in {"PAID", "CANCELLED", "CANCELED"}:
        return None
    meta = ob.meta or {}
    currency = str(meta.get("currency") or "RUB")
    title = (ob.title or ob.creditor or ob.type or "Обязательство").strip()
    amount_txt = money_desc(ob.amount, currency)
    desc_parts = [p for p in [amount_txt, ob.type, f"status={ob.status}"] if p]
    uid = f"obligation-{ob.id}@liniya-resheniya"
    return build_vevent(
        uid=uid,
        summary=title,
        due=ob.due_date,
        description=" · ".join(desc_parts),
        stamp=stamp,
        alarm_days=alarm_days,
        recurring=bool(ob.recurring),
    )


def build_calendar_ics(
    obligations: list[FinancialObligation],
    *,
    calendar_name: str = "Финансовый календарь",
    alarm_days: Iterable[int] = (),
    date_from: date | None = None,
    date_to: date | None = None,
) -> str:
    stamp = datetime.now(timezone.utc)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Liniya Resheniya//Calendar//RU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{escape_text(calendar_name)}",
    ]
    for ob in obligations:
        due = ob.due_date
        if due is None:
            continue
        if date_from and due < date_from:
            continue
        if date_to and due > date_to:
            continue
        vevent = serialize_obligation_event(ob, alarm_days=alarm_days, stamp=stamp)
        if vevent:
            lines.extend(vevent)
    lines.append("END:VCALENDAR")
    # CRLF + fold
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def default_reminder_settings() -> dict[str, Any]:
    return {
        "enabled": True,
        "days_before": [7, 3, 1],
        "channels": ["IN_APP"],
        "types": ["loan", "tax", "rent", "salary", "supplier", "task", "other"],
    }


def merge_reminder_settings(raw: dict[str, Any] | None) -> dict[str, Any]:
    base = default_reminder_settings()
    if not raw:
        return base
    out = dict(base)
    if "enabled" in raw:
        out["enabled"] = bool(raw["enabled"])
    days = raw.get("days_before") if "days_before" in raw else raw.get("daysBefore")
    if isinstance(days, list):
        cleaned = sorted({int(x) for x in days if int(x) >= 0})
        out["days_before"] = cleaned or base["days_before"]
    elif isinstance(days, (int, float)):
        out["days_before"] = [int(days)]
    channels = raw.get("channels")
    if isinstance(channels, list) and channels:
        out["channels"] = [str(c).upper() for c in channels]
    types = raw.get("types")
    if isinstance(types, list) and types:
        out["types"] = [str(t).lower() for t in types]
    return out
