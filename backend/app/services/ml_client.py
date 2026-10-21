from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def ml_enabled() -> bool:
    s = get_settings()
    return bool(getattr(s, "ml_service_enabled", False) and getattr(s, "ml_service_url", ""))


def _base() -> str:
    return get_settings().ml_service_url.rstrip("/")


def _timeout() -> float:
    return float(getattr(get_settings(), "ml_service_timeout", 8.0))


def _post(path: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    if not ml_enabled():
        return None
    url = f"{_base()}{path}"
    try:
        with httpx.Client(timeout=_timeout()) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        logger.warning("ML service call failed path=%s err=%s", path, type(exc).__name__)
        return None


def forecast_via_ml(
    *,
    company_id: str,
    transactions: list[Any],
    cash_balance: Decimal,
    horizon_days: int,
    planned_payments: list[dict] | None = None,
) -> dict[str, Any] | None:
    txs = []
    for t in transactions:
        txs.append(
            {
                "transaction_id": getattr(t, "id", None) or str(id(t)),
                "date": getattr(t, "date", None).isoformat()
                if getattr(t, "date", None)
                else None,
                "amount": str(getattr(t, "amount", 0)),
                "direction": getattr(t, "direction", None),
                "counterparty": getattr(t, "counterparty", None),
                "purpose": getattr(t, "purpose", None),
                "category": getattr(t, "category", None).value
                if hasattr(getattr(t, "category", None), "value")
                else getattr(t, "category", None),
                "source": getattr(t, "source", "db"),
            }
        )
    raw = _post(
        "/api/v1/ml/cashflow/forecast",
        {
            "company_id": company_id,
            "transactions": txs,
            "cash_balance": str(cash_balance),
            "horizon_days": horizon_days,
            "planned_payments": planned_payments or [],
        },
    )
    if not raw:
        return None
    points = raw.get("points") or []
    for p in points:
        if "net_cash_flow" not in p and "predicted_net_cashflow" in p:
            p["net_cash_flow"] = p["predicted_net_cashflow"]
        if "closing_balance" not in p and "predicted_closing_balance" in p:
            p["closing_balance"] = p["predicted_closing_balance"]
        if "lower_bound" not in p and "lower_balance" in p:
            p["lower_bound"] = p["lower_balance"]
        if "upper_bound" not in p and "upper_balance" in p:
            p["upper_bound"] = p["upper_balance"]
    return {
        "horizon_days": raw.get("horizon_days", horizon_days),
        "points": points,
        "minimum_balance": raw.get("minimum_balance"),
        "cash_gap_amount": raw.get("cash_gap_amount"),
        "cash_gap_date": raw.get("cash_gap_date"),
        "data_quality": raw.get("data_quality", "limited"),
        "model_version": raw.get("model_version", "ml-service"),
        "warning": raw.get("warning"),
    }


def recommend_via_ml(payload: dict[str, Any]) -> dict[str, Any] | None:
    raw = _post("/api/v1/ml/credit/recommend", payload)
    if not raw:
        return None
    return {
        "company_id": raw["company_id"],
        "business_goal": raw["business_goal"],
        "requested_amount": raw["requested_amount"],
        "currency": raw.get("currency", "RUB"),
        "recommendations": [
            {
                "product_id": r["product_id"],
                "product_type": r["product_type"],
                "product_name": r["product_name"],
                "match_score": r["match_score"],
                "eligible_by_basic_rules": r["eligible_by_basic_rules"],
                "estimated_monthly_payment": r["estimated_monthly_payment"],
                "estimated_rate": r["estimated_rate"],
                "recommended_amount": r["recommended_amount"],
                "recommended_term": r["recommended_term"],
                "reasons": r["reasons"],
                "warnings": r["warnings"],
            }
            for r in raw.get("recommendations", [])
        ],
        "is_official_offer": False,
        "model_version": raw.get("model_version", "ml-service"),
    }


def classify_via_ml(company_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    raw = _post(
        "/api/v1/ml/transactions/classify",
        {"company_id": company_id, "transactions": rows, "source": "statement"},
    )
    if not raw:
        return None
    out = []
    for t in raw.get("transactions", []):
        out.append(
            {
                "date": t.get("transaction_date") or t.get("date"),
                "amount": t.get("amount"),
                "direction": t.get("direction"),
                "counterparty": t.get("counterparty"),
                "purpose": t.get("description") or t.get("purpose"),
                "category": t.get("category"),
                "confidence": t.get("confidence"),
                "balance": t.get("balance_after"),
            }
        )
    return out
