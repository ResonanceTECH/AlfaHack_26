"""Дополняет существующие демо-компании синтетическими сведениями скоринга."""
from sqlalchemy import select

from credit_scoring import to_jsonable
from credit_scoring.generator import personas
from app.models.finance import FinancialSnapshot


def seed_scoring(db):
    scenarios = {p.id: p.input for p in personas()}
    for company_id, persona_id in {"company_001": "ideal", "company_002": "overdue"}.items():
        for snap in db.scalars(select(FinancialSnapshot).where(FinancialSnapshot.company_id == company_id)):
            metrics = dict(snap.metrics or {})
            if "scoring" in metrics:
                continue
            source = scenarios[persona_id]
            revenue = float(snap.avg_monthly_revenue) * 12
            metrics["scoring"] = {
                "source": "synthetic-personas-v1", "persona_id": persona_id,
                "okved_main": source.egrul.okved_main,
                "bki": to_jsonable(source.bki), "fns": to_jsonable(source.fns),
                "financials": {"revenue_12m": revenue,
                               "expenses_12m": float(snap.operating_expenses) * 12,
                               "revenue_prev_12m": revenue / 1.2},
            }
            snap.metrics = metrics
    db.flush()
