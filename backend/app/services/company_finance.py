from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.enums import ProductStatus, StatementStatus, TransactionCategory
from app.models.application import CreditApplication
from app.models.company import Company
from app.models.credit import CreditProduct
from app.models.finance import (
    AiConversation,
    AiMessage,
    CashflowForecast,
    CreditScenario,
    FinancialObligation,
    FinancialSnapshot,
    FinancialStatement,
    Transaction,
)
from app.models.ml_registry import ModelActivation, MlModelRegistry
from app.services.finance_engine import round2
from app.services.forecast import build_cashflow_forecast
from app.services.readiness import VERSION as READINESS_VERSION
from app.services.readiness import compute_readiness
from app.services.statements import build_import_result, parse_statement_bytes


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_period(period: str) -> int:
    p = (period or "6m").strip().lower()
    if p.endswith("m") and p[:-1].isdigit():
        return max(1, min(36, int(p[:-1])))
    if p.endswith("y") and p[:-1].isdigit():
        return max(1, min(36, int(p[:-1]) * 12))
    return 6


def serialize_statement(st: FinancialStatement, *, tx_count: int | None = None) -> dict[str, Any]:
    summary = st.parsed_summary or {}
    label = (st.raw_payload or {}).get("source_label") if st.raw_payload else None
    return {
        "id": st.id,
        "company_id": st.company_id,
        "period_from": st.period_from,
        "period_to": st.period_to,
        "source_type": st.source_type,
        "source_label": label,
        "file_name": st.file_name,
        "status": st.status,
        "processing_status": st.status,
        "tx_count": tx_count if tx_count is not None else summary.get("tx_count", 0),
        "error_message": st.error_message,
        "uploaded_at": st.uploaded_at,
        "processed_at": st.processed_at,
        "parsed_summary": summary,
        "errors": summary.get("errors") or ([] if not st.error_message else [st.error_message]),
        "structure": summary.get("structure") or {"columns": ["date", "amount", "direction", "purpose", "counterparty"]},
    }


def list_statements(db: Session, company_id: str) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(FinancialStatement)
            .where(FinancialStatement.company_id == company_id)
            .order_by(FinancialStatement.uploaded_at.desc())
        ).all()
    )
    out = []
    for st in rows:
        cnt = db.scalar(
            select(func.count()).select_from(Transaction).where(Transaction.statement_id == st.id)
        ) or 0
        out.append(serialize_statement(st, tx_count=int(cnt)))
    return out


def get_statement(db: Session, company_id: str, statement_id: str) -> FinancialStatement | None:
    st = db.get(FinancialStatement, statement_id)
    if st is None or st.company_id != company_id:
        return None
    return st


def import_statement_sync(
    db: Session,
    *,
    company_id: str,
    content: bytes,
    filename: str,
    file_path: str | None,
    period_start: date | None,
    period_end: date | None,
    source_label: str | None,
) -> FinancialStatement:
    st = FinancialStatement(
        company_id=company_id,
        period_from=period_start,
        period_to=period_end,
        source_type="UPLOAD",
        file_name=filename,
        file_path=file_path,
        status=StatementStatus.PROCESSING,
        raw_payload={"source_label": source_label},
    )
    db.add(st)
    db.flush()

    try:
        parsed = parse_statement_bytes(content, filename)
        result = build_import_result(company_id, parsed)
        dates = [t["date"] for t in result["transactions"]]
        st.period_from = period_start or (min(dates) if dates else None)
        st.period_to = period_end or (max(dates) if dates else None)

        inserted = 0
        for t in result["transactions"]:
            exists = db.scalar(
                select(Transaction).where(
                    Transaction.company_id == company_id,
                    Transaction.external_hash == t["external_hash"],
                )
            )
            if exists:
                if exists.statement_id is None:
                    exists.statement_id = st.id
                continue
            db.add(
                Transaction(
                    id=t["id"],
                    company_id=company_id,
                    statement_id=st.id,
                    date=t["date"],
                    amount=t["amount"],
                    direction=t["direction"],
                    counterparty=t["counterparty"],
                    purpose=t["purpose"],
                    category=t["category"],
                    balance_after=t.get("balance"),
                    source="statement",
                    external_hash=t["external_hash"],
                )
            )
            inserted += 1

        st.status = StatementStatus.COMPLETED
        st.processed_at = utcnow()
        st.parsed_summary = {
            "tx_count": len(result["transactions"]),
            "inserted": inserted,
            "summary": {k: str(v) if isinstance(v, Decimal) else v for k, v in result["summary"].items()},
            "monthly": [
                {**m, "inflow": str(m["inflow"]), "outflow": str(m["outflow"])}
                for m in result["monthly"]
            ],
            "structure": {"format": filename.rsplit(".", 1)[-1].lower(), "rows": len(parsed)},
            "errors": [],
        }
        st.error_message = None
    except ValueError as exc:
        st.status = StatementStatus.FAILED
        st.error_message = str(exc)
        st.processed_at = utcnow()
        st.parsed_summary = {"tx_count": 0, "errors": [str(exc)], "structure": {}}
    db.flush()
    return st


def confirm_statement(db: Session, st: FinancialStatement) -> FinancialStatement:
    if st.status not in (StatementStatus.COMPLETED, StatementStatus.CONFIRMED):
        from app.core.errors import AppError
        from fastapi import status as http_status

        raise AppError(
            "NOT_READY",
            "Подтвердить можно только успешно разобранную выписку",
            status_code=http_status.HTTP_409_CONFLICT,
        )
    st.status = StatementStatus.CONFIRMED
    db.flush()
    return st


def list_transactions(
    db: Session,
    company_id: str,
    *,
    category: TransactionCategory | None = None,
    direction: str | None = None,
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Transaction]:
    stmt = select(Transaction).where(Transaction.company_id == company_id)
    if category:
        stmt = stmt.where(Transaction.category == category)
    if direction:
        stmt = stmt.where(Transaction.direction == direction)
    if date_from:
        stmt = stmt.where(Transaction.date >= date_from)
    if date_to:
        stmt = stmt.where(Transaction.date <= date_to)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Transaction.purpose.ilike(like), Transaction.counterparty.ilike(like))
        )
    return list(
        db.scalars(stmt.order_by(Transaction.date.desc()).offset(offset).limit(min(limit, 500))).all()
    )


def serialize_tx(tx: Transaction) -> dict[str, Any]:
    return {
        "id": tx.id,
        "company_id": tx.company_id,
        "statement_id": tx.statement_id,
        "date": tx.date,
        "amount": tx.amount,
        "currency": tx.currency or "RUB",
        "direction": tx.direction,
        "category": tx.category,
        "counterparty": tx.counterparty,
        "purpose": tx.purpose,
        "description": tx.description,
        "balance_after": tx.balance_after,
    }


def transactions_analytics(db: Session, company_id: str, *, period: str = "6m") -> dict[str, Any]:
    months = _parse_period(period)
    since = date.today() - relativedelta(months=months)
    txs = list(
        db.scalars(
            select(Transaction).where(
                Transaction.company_id == company_id,
                Transaction.date >= since,
            )
        ).all()
    )
    by_cat: dict[str, Decimal] = {}
    for t in txs:
        if t.category == TransactionCategory.TRANSFER_INTERNAL:
            continue
        key = t.category.value if t.category else "other"
        by_cat[key] = by_cat.get(key, Decimal("0")) + Decimal(str(t.amount))

    purpose_map: dict[str, list[Transaction]] = {}
    for t in txs:
        if t.direction != "out":
            continue
        key = f"{(t.purpose or '')[:40]}|{t.amount}"
        purpose_map.setdefault(key, []).append(t)
    recurring = [
        {
            "key": k,
            "count": len(v),
            "amount": str(round2(Decimal(str(v[0].amount)))),
            "purpose": v[0].purpose,
        }
        for k, v in purpose_map.items()
        if len(v) >= 2
    ][:20]

    internal = sum(1 for t in txs if t.category == TransactionCategory.TRANSFER_INTERNAL)
    return {
        "period": period,
        "by_category": [
            {"category": k, "amount": str(round2(v))} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])
        ],
        "recurring": recurring,
        "exclusions": {"internal_transfers": internal},
    }


def finance_summary(db: Session, company_id: str, *, period: str = "6m") -> dict[str, Any]:
    months = _parse_period(period)
    since = date.today() - relativedelta(months=months)
    txs = list(
        db.scalars(
            select(Transaction).where(Transaction.company_id == company_id, Transaction.date >= since)
        ).all()
    )
    external = [t for t in txs if t.category != TransactionCategory.TRANSFER_INTERNAL]
    inflow = sum(
        (Decimal(str(t.amount)) for t in external if t.direction == "in"),
        Decimal("0"),
    )
    revenue = sum(
        (
            Decimal(str(t.amount))
            for t in external
            if t.direction == "in" and t.category == TransactionCategory.REVENUE
        ),
        Decimal("0"),
    )
    outflow = sum((Decimal(str(t.amount)) for t in external if t.direction == "out"), Decimal("0"))

    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    obligations = list(
        db.scalars(
            select(FinancialObligation).where(
                FinancialObligation.company_id == company_id,
                FinancialObligation.status == "ACTIVE",
            )
        ).all()
    )
    liabilities = sum((Decimal(str(o.remaining or o.amount)) for o in obligations), Decimal("0"))
    if snap:
        cash = Decimal(str(snap.cash_balance or 0))
        if not liabilities:
            liabilities = Decimal(str(snap.liabilities or 0))
        active_credits = Decimal(str(snap.active_credits or 0))
        debt_load = Decimal(str(snap.debt_load or 0))
    else:
        cash = Decimal("0")
        for t in sorted(txs, key=lambda x: x.date):
            if t.balance_after is not None:
                cash = Decimal(str(t.balance_after))
        active_credits = liabilities
        debt_load = None

    confirmed = (
        db.scalar(
            select(func.count())
            .select_from(FinancialStatement)
            .where(
                FinancialStatement.company_id == company_id,
                FinancialStatement.status == StatementStatus.CONFIRMED,
            )
        )
        or 0
    ) > 0

    source = "statements" if txs else ("snapshot" if snap else "empty")
    return {
        "period": period,
        "currency": "RUB",
        "revenue": round2(revenue),
        "inflow": round2(inflow),
        "outflow": round2(outflow),
        "net_cash_flow": round2(inflow - outflow),
        "cash_balance": round2(cash),
        "liabilities": round2(liabilities),
        "active_credits": round2(active_credits),
        "debt_load": round2(debt_load) if debt_load is not None else None,
        "source": source,
        "as_of": utcnow(),
        "statement_confirmed": confirmed,
    }


def finance_series(db: Session, company_id: str, *, period: str = "12m") -> dict[str, Any]:
    months = _parse_period(period)
    since = date.today().replace(day=1) - relativedelta(months=months - 1)
    txs = list(
        db.scalars(
            select(Transaction).where(Transaction.company_id == company_id, Transaction.date >= since)
        ).all()
    )
    buckets: dict[str, dict[str, Decimal]] = {}
    for i in range(months):
        m = (since + relativedelta(months=i)).strftime("%Y-%m")
        buckets[m] = {"inflow": Decimal("0"), "outflow": Decimal("0"), "cash": Decimal("0")}

    last_balance: Decimal | None = None
    for t in sorted(txs, key=lambda x: x.date):
        if t.category == TransactionCategory.TRANSFER_INTERNAL:
            continue
        key = t.date.strftime("%Y-%m")
        if key not in buckets:
            continue
        if t.direction == "in":
            buckets[key]["inflow"] += Decimal(str(t.amount))
        else:
            buckets[key]["outflow"] += Decimal(str(t.amount))
        if t.balance_after is not None:
            last_balance = Decimal(str(t.balance_after))
            buckets[key]["cash"] = last_balance

    points = []
    running = last_balance
    for m in sorted(buckets):
        b = buckets[m]
        net = b["inflow"] - b["outflow"]
        cash = b["cash"] if b["cash"] else running
        points.append(
            {
                "period": m,
                "inflow": round2(b["inflow"]),
                "outflow": round2(b["outflow"]),
                "net": round2(net),
                "cash_balance": round2(cash) if cash is not None else None,
            }
        )
        if cash is not None:
            running = cash
    return {"period": period, "currency": "RUB", "points": points, "source": "transactions"}


def create_forecast(
    db: Session,
    company_id: str,
    *,
    horizon_days: int,
    include_uncertainty: bool,
    planned_payments: list[dict] | None,
) -> dict[str, Any]:
    txs = list(db.scalars(select(Transaction).where(Transaction.company_id == company_id)).all())
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    cash = Decimal(str(snap.cash_balance)) if snap else Decimal("0")
    raw = build_cashflow_forecast(
        transactions=txs,
        cash_balance=cash,
        horizon_days=horizon_days,
        planned_payments=planned_payments,
        company_id=company_id,
    )
    points = []
    for p in raw.get("points") or []:
        pt = {
            "date": p["date"].isoformat() if hasattr(p["date"], "isoformat") else str(p["date"]),
            "inflow": str(round2(Decimal(str(p.get("predicted_inflow", 0))))),
            "outflow": str(round2(Decimal(str(p.get("predicted_outflow", 0))))),
            "closing_balance": str(round2(Decimal(str(p.get("closing_balance", 0))))),
        }
        if include_uncertainty:
            pt["lower_balance"] = str(round2(Decimal(str(p.get("lower_bound", p.get("closing_balance", 0))))))
            pt["upper_balance"] = str(round2(Decimal(str(p.get("upper_bound", p.get("closing_balance", 0))))))
        points.append(pt)

    cash_gaps = []
    if raw.get("cash_gap_date"):
        cash_gaps.append(
            {
                "date": str(raw["cash_gap_date"]),
                "amount": str(raw.get("cash_gap_amount") or "0"),
            }
        )

    quality_label = raw.get("data_quality") or "limited"
    status = "INSUFFICIENT_DATA" if quality_label == "insufficient" else "COMPLETED"
    fc = CashflowForecast(
        company_id=company_id,
        horizon_months=max(1, horizon_days // 30),
        model_version=raw.get("model_version"),
        points=points,
        assumptions={
            "horizon_days": horizon_days,
            "status": status,
            "quality": quality_label,
            "include_uncertainty": include_uncertainty,
            "cash_gaps": cash_gaps,
            "minimum_balance": str(raw.get("minimum_balance") or "0"),
        },
        disclaimer=raw.get("warning"),
    )
    db.add(fc)
    db.flush()
    return serialize_forecast(fc)


def serialize_forecast(fc: CashflowForecast) -> dict[str, Any]:
    assumptions = fc.assumptions or {}
    return {
        "id": fc.id,
        "status": assumptions.get("status", "COMPLETED"),
        "currency": "RUB",
        "horizon_days": assumptions.get("horizon_days") or (fc.horizon_months or 3) * 30,
        "model": {
            "name": "cashflow-baseline",
            "version": fc.model_version or "v1",
            "mode": "RULE_BASELINE",
        },
        "quality": {
            "history_days": None,
            "label": assumptions.get("quality"),
            "warning": fc.disclaimer,
        },
        "points": fc.points or [],
        "cash_gaps": assumptions.get("cash_gaps") or [],
        "warning": fc.disclaimer,
        "created_at": fc.generated_at,
    }


def get_forecast(db: Session, company_id: str, forecast_id: str) -> CashflowForecast | None:
    fc = db.get(CashflowForecast, forecast_id)
    if fc is None or fc.company_id != company_id:
        return None
    return fc


def create_scenario(db: Session, company_id: str, data: dict[str, Any]) -> CreditScenario:
    summary = finance_summary(db, company_id, period="6m")
    base_rev = Decimal(str(summary["revenue"]))
    base_out = Decimal(str(summary["outflow"]))
    rev_pct = float(data.get("revenue_change_pct") or 0)
    exp_pct = float(data.get("expense_change_pct") or 0)
    stress = bool(data.get("stress"))
    if stress:
        rev_pct = min(rev_pct, -15)
        exp_pct = max(exp_pct, 10)
    new_rev = round2(base_rev * Decimal(str(1 + rev_pct / 100)))
    new_out = round2(base_out * Decimal(str(1 + exp_pct / 100)))
    loan = data.get("loan_amount")
    loan_d = Decimal(str(loan)) if loan is not None else Decimal("0")
    result = {
        "base": {
            "revenue": str(summary["revenue"]),
            "outflow": str(summary["outflow"]),
            "net": str(summary["net_cash_flow"]),
            "cash_balance": str(summary["cash_balance"]),
        },
        "projected": {
            "revenue": str(new_rev),
            "outflow": str(new_out),
            "net": str(round2(new_rev - new_out)),
            "cash_after_loan": str(round2(Decimal(str(summary["cash_balance"])) + loan_d)),
        },
        "loan_amount": str(round2(loan_d)),
        "stress": stress,
        "note": "Детерминированный what-if на агрегатах выписки/snapshot",
    }
    params = {
        "revenue_change_pct": rev_pct,
        "expense_change_pct": exp_pct,
        "stress": stress,
        "loan_amount": str(round2(loan_d)) if loan is not None else None,
        **(data.get("parameters") or {}),
    }
    sc = CreditScenario(
        company_id=company_id,
        name=data.get("name") or "Сценарий",
        parameters=params,
        result=result,
    )
    db.add(sc)
    db.flush()
    return sc


def list_scenarios(db: Session, company_id: str) -> list[CreditScenario]:
    return list(
        db.scalars(
            select(CreditScenario)
            .where(CreditScenario.company_id == company_id)
            .order_by(CreditScenario.created_at.desc())
        ).all()
    )


def serialize_scenario(sc: CreditScenario) -> dict[str, Any]:
    return {
        "id": sc.id,
        "company_id": sc.company_id,
        "name": sc.name,
        "parameters": sc.parameters or {},
        "result": sc.result or {},
        "created_at": sc.created_at,
    }


def build_credit_passport(db: Session, company: Company) -> dict[str, Any]:
    summary = finance_summary(db, company.id, period="12m")
    apps = list(
        db.scalars(select(CreditApplication).where(CreditApplication.company_id == company.id)).all()
    )
    by_status: dict[str, int] = {}
    for a in apps:
        key = a.status.value if hasattr(a.status, "value") else str(a.status)
        by_status[key] = by_status.get(key, 0) + 1
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company.id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    sources = [
        {"type": "company_profile", "as_of": company.updated_at.isoformat() if company.updated_at else None},
        {"type": "finance_summary", "as_of": summary["as_of"].isoformat() if summary.get("as_of") else None},
    ]
    if snap:
        sources.append({"type": "financial_snapshot", "period": snap.period, "source": snap.source})
    return {
        "company_id": company.id,
        "refreshed_at": utcnow(),
        "sources": sources,
        "profile": {
            "inn": company.inn,
            "name": company.name,
            "legal_form": company.legal_form.value if hasattr(company.legal_form, "value") else str(company.legal_form),
            "industry": company.industry,
            "region": company.region,
            "registration_date": company.registration_date.isoformat() if company.registration_date else None,
            "employees_count": company.employees_count,
            "registry_status": company.registry_status,
        },
        "financials": {
            "revenue_12m": str(summary["revenue"]),
            "net_cash_flow": str(summary["net_cash_flow"]),
            "cash_balance": str(summary["cash_balance"]),
            "liabilities": str(summary["liabilities"]),
            "source": summary["source"],
        },
        "credit_exposure": {
            "active_credits": str(summary["active_credits"]),
            "debt_load": str(summary["debt_load"]) if summary.get("debt_load") is not None else None,
        },
        "applications_summary": {"total": len(apps), "by_status": by_status},
        "disclaimer": (
            "Кредитный паспорт — агрегация демо-данных платформы, не бюро кредитных историй."
        ),
    }


def company_readiness(db: Session, company: Company) -> dict[str, Any]:
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company.id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    product = db.scalar(
        select(CreditProduct).where(
            CreditProduct.status == ProductStatus.PUBLISHED,
            CreditProduct.is_active.is_(True),
        )
    )
    age = 0
    if company.registration_date:
        age = (date.today() - company.registration_date).days // 30
    raw = compute_readiness(
        company=company,
        financials=snap,
        product=product,
        documents=[],
        business_age_months=age,
    )
    missing: list[str] = []
    recs: list[str] = []
    checklist = []
    for f in raw.get("factors") or []:
        checklist.append(
            {
                "key": f.get("key"),
                "label": f.get("label"),
                "ok": not f.get("missing"),
                "score": f.get("score"),
                "max_score": f.get("max_score"),
            }
        )
        missing.extend(f.get("missing") or [])
        recs.extend(f.get("recommendations") or [])
    return {
        "company_id": company.id,
        "score": int(raw.get("score") or 0),
        "max_score": 100,
        "checklist": checklist,
        "factors": raw.get("factors") or [],
        "missing": missing,
        "recommendations": recs,
        "version": raw.get("version") or READINESS_VERSION,
        "disclaimer": (
            "Индекс готовности данных — не вероятность одобрения и не скоринг банка."
        ),
    }


def list_conversations(db: Session, company_id: str, user_id: str) -> list[AiConversation]:
    return list(
        db.scalars(
            select(AiConversation)
            .where(AiConversation.company_id == company_id, AiConversation.user_id == user_id)
            .order_by(AiConversation.created_at.desc())
        ).all()
    )


def create_conversation(
    db: Session, *, company_id: str, user_id: str, title: str | None
) -> AiConversation:
    conv = AiConversation(company_id=company_id, user_id=user_id, title=title or "Консультация")
    db.add(conv)
    db.flush()
    return conv


def get_conversation(
    db: Session, company_id: str, conversation_id: str, user_id: str
) -> AiConversation | None:
    conv = db.get(AiConversation, conversation_id)
    if conv is None or conv.company_id != company_id or conv.user_id != user_id:
        return None
    return conv


def list_messages(db: Session, conversation_id: str) -> list[AiMessage]:
    return list(
        db.scalars(
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.asc())
        ).all()
    )


def serialize_message(msg: AiMessage) -> dict[str, Any]:
    meta = msg.meta or {}
    return {
        "id": msg.id,
        "role": msg.role,
        "content": msg.content,
        "sources": meta.get("sources") or [],
        "suggested_actions": meta.get("suggested_actions") or [],
        "created_at": msg.created_at,
    }


def assistant_status(db: Session) -> dict[str, Any]:
    act = db.scalar(
        select(ModelActivation)
        .where(ModelActivation.task == "AI_ASSISTANT", ModelActivation.is_active.is_(True))
        .limit(1)
    )
    model_name = None
    mode = "RULES_FALLBACK"
    if act:
        m = db.get(MlModelRegistry, act.model_id)
        if m:
            model_name = f"{m.name}@{m.version}"
            mode = "MODEL_ACTIVE"
    return {
        "ready": True,
        "mode": mode,
        "model_active": model_name,
        "disclaimer": "Локальная модель опциональна; активен rule-based fallback.",
    }
