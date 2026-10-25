from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ApplicationStatus, OfferStatus, ProductType
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.decision import CreditDecision

SUBMITTED_PLUS: frozenset[ApplicationStatus] = frozenset(
    s for s in ApplicationStatus if s != ApplicationStatus.DRAFT
)

APPROVED_PLUS: frozenset[ApplicationStatus] = frozenset(
    {
        ApplicationStatus.APPROVED,
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.AGREEMENT_PREPARATION,
        ApplicationStatus.ISSUED,
    }
)

TAKE_UP: frozenset[ApplicationStatus] = frozenset(
    {
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.AGREEMENT_PREPARATION,
        ApplicationStatus.ISSUED,
    }
)

FUNNEL: list[tuple[str, frozenset[ApplicationStatus]]] = [
    (
        "Подана",
        frozenset(
            {
                ApplicationStatus.SUBMITTED,
                ApplicationStatus.VALIDATING,
                ApplicationStatus.IN_REVIEW,
                ApplicationStatus.DOCS_REQUESTED,
                ApplicationStatus.APPROVED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.COUNTEROFFERED,
                ApplicationStatus.OFFER_ACCEPTED,
                ApplicationStatus.AGREEMENT_PREPARATION,
                ApplicationStatus.ISSUED,
            }
        ),
    ),
    (
        "Автопроверки",
        frozenset(
            {
                ApplicationStatus.VALIDATING,
                ApplicationStatus.IN_REVIEW,
                ApplicationStatus.DOCS_REQUESTED,
                ApplicationStatus.APPROVED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.COUNTEROFFERED,
                ApplicationStatus.OFFER_ACCEPTED,
                ApplicationStatus.AGREEMENT_PREPARATION,
                ApplicationStatus.ISSUED,
            }
        ),
    ),
    (
        "Документы",
        frozenset(
            {
                ApplicationStatus.DOCS_REQUESTED,
                ApplicationStatus.IN_REVIEW,
                ApplicationStatus.APPROVED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.COUNTEROFFERED,
                ApplicationStatus.OFFER_ACCEPTED,
                ApplicationStatus.AGREEMENT_PREPARATION,
                ApplicationStatus.ISSUED,
            }
        ),
    ),
    (
        "Аналитик",
        frozenset(
            {
                ApplicationStatus.IN_REVIEW,
                ApplicationStatus.APPROVED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.COUNTEROFFERED,
                ApplicationStatus.OFFER_ACCEPTED,
                ApplicationStatus.AGREEMENT_PREPARATION,
                ApplicationStatus.ISSUED,
            }
        ),
    ),
    (
        "Риск-оценка",
        frozenset(
            {
                ApplicationStatus.APPROVED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.COUNTEROFFERED,
                ApplicationStatus.OFFER_ACCEPTED,
                ApplicationStatus.AGREEMENT_PREPARATION,
                ApplicationStatus.ISSUED,
            }
        ),
    ),
    (
        "Решение: одобрено",
        APPROVED_PLUS,
    ),
    (
        "Принято клиентом",
        TAKE_UP,
    ),
]

PRODUCT_LABELS: dict[str, str] = {
    ProductType.WORKING_CAPITAL.value: "Оборотный",
    ProductType.INVESTMENT.value: "Инвестиц.",
    ProductType.OVERDRAFT.value: "Овердрафт",
    ProductType.CREDIT_LINE.value: "Линия",
}

REASON_LABELS: dict[str, str] = {
    "HIGH_DEBT_BURDEN": "Низкий DSCR",
    "MAX_DEBT_BURDEN": "Низкий DSCR",
    "UNSTABLE_CASHFLOW": "Падение выручки",
    "AMOUNT_TOO_HIGH": "Прочее",
    "DOCS": "Нехватка документов",
    "CREDIT_HISTORY": "Кредитная история",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _f(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _pct(num: float, den: float) -> float:
    if den <= 0:
        return 0.0
    return round(100.0 * num / den, 1)


def _hours(app: CreditApplication) -> float | None:
    start = _aware(app.submitted_at) or _aware(app.created_at)
    end = _aware(app.decided_at) or _aware(app.updated_at)
    if start is None or end is None:
        return None
    delta = (end - start).total_seconds() / 3600.0
    return max(0.0, delta)


def _avg(values: Iterable[float]) -> float:
    seq = [v for v in values if v is not None]
    if not seq:
        return 0.0
    return round(sum(seq) / len(seq), 2)


def _iso_week(dt: datetime | None) -> str:
    dt = _aware(dt)
    if dt is None:
        return "—"
    return str(dt.isocalendar().week)


def _match_region(company: Company | None, region: str | None) -> bool:
    if not region or region.lower() in ("all", "*"):
        return True
    if company is None:
        return False
    raw = (company.region or "").lower()
    key = region.lower()
    if key in ("msk", "moscow", "москва"):
        return "моск" in raw or "moscow" in raw
    if key in ("spb", "спб", "санкт-петербург", "питер"):
        return "петербург" in raw or "спб" in raw or "petersburg" in raw
    if key in ("other", "другие"):
        return "моск" not in raw and "петербург" not in raw and "спб" not in raw
    return key in raw


def _match_product(app: CreditApplication, product: str | None) -> bool:
    if not product or product.lower() in ("all", "*"):
        return True
    key = product.lower()
    ptype = app.product_type.value if app.product_type else ""
    pid = (app.product_id or "").lower()
    pname = (app.product_name or "").lower()
    return key in {ptype.lower(), pid} or key in pname


def _channel(app: CreditApplication) -> str:
    _ = app
    return "web"


def _match_channel(app: CreditApplication, channel: str | None) -> bool:
    if not channel or channel.lower() in ("all", "*"):
        return True
    return _channel(app) == channel.lower()


def _reason_name(app: CreditApplication, decisions: list[CreditDecision]) -> str:
    if app.rejection_reason:
        text = app.rejection_reason.lower()
        if "документ" in text:
            return "Нехватка документов"
        if "выруч" in text or "денежн" in text:
            return "Падение выручки"
        if "долг" in text or "dscr" in text:
            return "Низкий DSCR"
        if "истори" in text:
            return "Кредитная история"
        return "Прочее"
    for d in decisions:
        for code in d.reason_codes or []:
            return REASON_LABELS.get(str(code), "Прочее")
    return "Прочее"


def _issued_amount(app: CreditApplication) -> float:
    if app.status in TAKE_UP:
        offers = [o for o in (app.offers or []) if o.status in (OfferStatus.ACCEPTED, OfferStatus.ACTIVE)]
        if offers:
            return _f(offers[0].amount)
        return _f(app.amount)
    return 0.0


def _approved_offer_amount(app: CreditApplication) -> float:
    if app.status not in APPROVED_PLUS | {ApplicationStatus.COUNTEROFFERED}:
        return 0.0
    offers = list(app.offers or [])
    accepted = [o for o in offers if o.status == OfferStatus.ACCEPTED]
    pool = accepted or offers
    if pool:
        return _f(pool[0].amount)
    if app.status in APPROVED_PLUS:
        return _f(app.amount)
    return 0.0


def _risk_segment(app: CreditApplication) -> str:
    score = app.readiness_score
    if score is None:
        return "B"
    if score >= 75:
        return "A"
    if score >= 60:
        return "B+"
    if score >= 40:
        return "B"
    return "C"


def build_conveyor(
    db: Session,
    *,
    period: int = 30,
    product: str | None = None,
    region: str | None = None,
    channel: str | None = None,
) -> dict[str, Any]:
    days = max(1, min(int(period or 30), 365))
    since = utcnow() - timedelta(days=days)

    rows = list(
        db.scalars(
            select(CreditApplication)
            .options(
                joinedload(CreditApplication.company),
                joinedload(CreditApplication.offers),
                joinedload(CreditApplication.decisions),
            )
            .where(CreditApplication.status != ApplicationStatus.DRAFT)
        )
        .unique()
        .all()
    )

    apps: list[CreditApplication] = []
    for app in rows:
        ts = _aware(app.submitted_at) or _aware(app.created_at)
        if ts is not None and ts < since:
            continue
        if not _match_product(app, product):
            continue
        if not _match_region(app.company, region):
            continue
        if not _match_channel(app, channel):
            continue
        apps.append(app)

    submitted = [a for a in apps if a.status in SUBMITTED_PLUS]
    pool = len(submitted)
    approved = [a for a in apps if a.status in APPROVED_PLUS]
    taken = [a for a in apps if a.status in TAKE_UP]
    issued_volume = sum(_issued_amount(a) for a in apps)
    # fallback: approved active offers so demo charts aren't empty
    if issued_volume == 0:
        issued_volume = sum(_approved_offer_amount(a) for a in approved)

    rates: list[tuple[float, float]] = []
    auto = 0
    decisions_n = 0
    for a in apps:
        for d in a.decisions or []:
            decisions_n += 1
            if d.decided_by is None or (d.model_version and d.decided_by is None):
                auto += 1
        for o in a.offers or []:
            if o.rate is not None:
                rates.append((_f(o.rate), _f(o.amount) or 1.0))
    if not rates:
        for a in apps:
            if a.rate is not None:
                rates.append((_f(a.rate), _f(a.amount) or 1.0))
    wsum = sum(r * w for r, w in rates)
    wden = sum(w for _, w in rates)
    avg_rate = round(wsum / wden, 2) if wden else 0.0

    kpis = {
        "apps": pool,
        "issued_volume": round(issued_volume, 2),
        "take_up_pct": _pct(len(taken), len(approved) or pool),
        "avg_rate": avg_rate,
        "auto_decision_pct": _pct(auto, decisions_n),
    }

    funnel = []
    prev_count = pool or 1
    for i, (stage, statuses) in enumerate(FUNNEL):
        stage_apps = [a for a in submitted if a.status in statuses]
        count = len(stage_apps)
        hours = _avg(h for a in stage_apps if (h := _hours(a)) is not None)
        dropoff = 0.0 if i == 0 else _pct(max(prev_count - count, 0), prev_count)
        funnel.append(
            {
                "stage": stage,
                "count": count,
                "conversion_pct": _pct(count, pool),
                "avg_hours": hours,
                "dropoff_pct": dropoff,
            }
        )
        prev_count = count

    by_product_map: dict[str, dict[str, Any]] = {}
    for a in submitted:
        key = a.product_type.value if a.product_type else "other"
        bucket = by_product_map.setdefault(
            key, {"product": PRODUCT_LABELS.get(key, key), "apps": 0, "approved": 0, "taken": 0, "volume": 0.0}
        )
        bucket["apps"] += 1
        if a.status in APPROVED_PLUS:
            bucket["approved"] += 1
        if a.status in TAKE_UP:
            bucket["taken"] += 1
        bucket["volume"] += _issued_amount(a) or (
            _approved_offer_amount(a) if a.status in APPROVED_PLUS else 0.0
        )
    by_product = [
        {
            "product": v["product"],
            "apps": v["apps"],
            "approval": _pct(v["approved"], v["apps"]),
            "take_up": _pct(v["taken"], v["approved"]),
            "volume": round(v["volume"], 2),
        }
        for v in by_product_map.values()
    ]

    by_channel_map: dict[str, dict[str, int]] = defaultdict(lambda: {"apps": 0, "approved": 0})
    for a in submitted:
        ch = _channel(a)
        by_channel_map[ch]["apps"] += 1
        if a.status in APPROVED_PLUS:
            by_channel_map[ch]["approved"] += 1
    by_channel = [
        {"channel": "Web" if k == "web" else k.capitalize(), "apps": v["apps"], "conv": _pct(v["approved"], v["apps"])}
        for k, v in by_channel_map.items()
    ]

    volume_week: dict[str, float] = defaultdict(float)
    conv_week: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for a in submitted:
        week = _iso_week(a.submitted_at or a.created_at)
        conv_week[week][0] += 1
        if a.status in APPROVED_PLUS:
            conv_week[week][1] += 1
        vol = _issued_amount(a) or (_approved_offer_amount(a) if a.status in APPROVED_PLUS else 0.0)
        if vol:
            volume_week[week] += vol
    volume_weekly = [{"week": k, "volume": round(v, 2)} for k, v in sorted(volume_week.items())]
    weekly_conv = [
        {"week": k, "pct": _pct(ok, total)}
        for k, (total, ok) in sorted(conv_week.items())
    ]

    reject_apps = [a for a in submitted if a.status == ApplicationStatus.REJECTED]
    reason_counts: dict[str, int] = defaultdict(int)
    for a in reject_apps:
        reason_counts[_reason_name(a, list(a.decisions or []))] += 1
    total_rej = sum(reason_counts.values()) or 1
    reject_reasons = [
        {"name": name, "value": _pct(cnt, total_rej)}
        for name, cnt in sorted(reason_counts.items(), key=lambda x: -x[1])
    ]

    sla_map: dict[str, list[float]] = defaultdict(list)
    for a in submitted:
        h = _hours(a)
        if h is not None:
            sla_map[_risk_segment(a)].append(h)
    order = ["A", "B+", "B", "C"]
    sla_by_segment = [{"segment": s, "hours": _avg(sla_map.get(s, []))} for s in order if s in sla_map]

    return {
        "kpis": kpis,
        "funnel": funnel,
        "by_product": by_product,
        "by_channel": by_channel,
        "volume_weekly": volume_weekly,
        "reject_reasons": reject_reasons,
        "weekly_conv": weekly_conv,
        "sla_by_segment": sla_by_segment,
    }


def conveyor_csv(payload: dict[str, Any]) -> str:
    lines = ["section,key,value"]
    kpis = payload.get("kpis") or {}
    for k, v in kpis.items():
        lines.append(f"kpis,{k},{v}")
    for row in payload.get("funnel") or []:
        lines.append(
            f"funnel,{row.get('stage')},{row.get('count')};{row.get('conversion_pct')};{row.get('avg_hours')};{row.get('dropoff_pct')}"
        )
    for row in payload.get("by_product") or []:
        lines.append(
            f"byProduct,{row.get('product')},{row.get('apps')};{row.get('approval')};{row.get('take_up')};{row.get('volume')}"
        )
    return "\n".join(lines) + "\n"
