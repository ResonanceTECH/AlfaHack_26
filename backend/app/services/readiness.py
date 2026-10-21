from __future__ import annotations

from datetime import datetime
from typing import Any

VERSION = "readiness-rules-v1"

WEIGHTS = {
    "company_completeness": 20,
    "financials": 25,
    "documents": 25,
    "product_fit": 20,
    "data_freshness": 10,
}

def compute_readiness(
    *,
    company: Any,
    financials: Any | None,
    product: Any | None,
    documents: list[Any] | None = None,
    business_age_months: int = 0,
) -> dict[str, Any]:
    documents = documents or []
    factors: list[dict[str, Any]] = []

    company_missing: list[str] = []
    company_fields = {
        "inn": company.inn,
        "name": company.name,
        "ogrn": company.ogrn,
        "industry": company.industry,
        "region": company.region,
        "registration_date": company.registration_date,
    }
    for k, v in company_fields.items():
        if v is None or v == "":
            company_missing.append(k)
    employees_ok = getattr(company, "employees_count", 0) is not None
    filled = len(company_fields) - len(company_missing) + (1 if employees_ok else 0)
    company_score = (filled / 7) * WEIGHTS["company_completeness"]
    factors.append(
        {
            "key": "company_completeness",
            "label": "Полнота данных компании",
            "weight": WEIGHTS["company_completeness"],
            "score": round(company_score, 1),
            "max_score": float(WEIGHTS["company_completeness"]),
            "missing": company_missing,
            "recommendations": (
                ["Заполните карточку компании полностью"] if company_missing else []
            ),
        }
    )

    fin_missing: list[str] = []
    fin_recs: list[str] = []
    if financials is None:
        fin_missing = ["financial_snapshot"]
        fin_score = 0.0
        fin_recs = ["Добавьте финансовые показатели или загрузите выписку"]
    else:
        for field in (
            "avg_monthly_revenue",
            "operating_expenses",
            "cash_balance",
            "liabilities",
            "active_credits",
        ):
            if getattr(financials, field, None) is None:
                fin_missing.append(field)
        base = (5 - len(fin_missing)) / 5
        confirmed_bonus = 0.15 if getattr(financials, "confirmed", False) else 0
        source_bonus = 0.1 if getattr(financials, "source", "") in ("statement", "aggregated") else 0
        fin_score = min(1.0, base + confirmed_bonus + source_bonus) * WEIGHTS["financials"]
        if not getattr(financials, "confirmed", False):
            fin_recs.append("Подтвердите финансовые показатели")
        if getattr(financials, "source", "") == "manual":
            fin_recs.append("Загрузите банковскую выписку для повышения достоверности")

    factors.append(
        {
            "key": "financials",
            "label": "Наличие финансовых сведений",
            "weight": WEIGHTS["financials"],
            "score": round(fin_score, 1),
            "max_score": float(WEIGHTS["financials"]),
            "missing": fin_missing,
            "recommendations": fin_recs,
        }
    )

    required_docs = list(product.documents) if product and product.documents else [
        "Паспорт",
        "Выписка ЕГРИП",
        "Банковская выписка 6 мес.",
    ]
    uploaded_types = {
        getattr(d, "document_type", None) or getattr(d, "type", None)
        for d in documents
        if getattr(d, "status", "uploaded") in ("uploaded", "verified")
    }
    missing_docs = [d for d in required_docs if d not in uploaded_types]
    doc_ratio = (len(required_docs) - len(missing_docs)) / max(1, len(required_docs))
    doc_score = doc_ratio * WEIGHTS["documents"]
    factors.append(
        {
            "key": "documents",
            "label": "Комплектность документов",
            "weight": WEIGHTS["documents"],
            "score": round(doc_score, 1),
            "max_score": float(WEIGHTS["documents"]),
            "missing": missing_docs,
            "recommendations": [f"Загрузите: {d}" for d in missing_docs[:5]],
        }
    )

    fit_missing: list[str] = []
    fit_recs: list[str] = []
    if product is None:
        fit_score = WEIGHTS["product_fit"] * 0.3
        fit_missing = ["product"]
        fit_recs = ["Выберите кредитный продукт"]
    else:
        legal_ok = (
            company.legal_form.value in (product.legal_forms or [])
            or company.legal_form in (product.legal_forms or [])
        )
        age_ok = business_age_months >= product.min_business_age_months
        fit_parts = [legal_ok, age_ok]
        if not legal_ok:
            fit_missing.append("legal_form")
            fit_recs.append("Юр. форма не соответствует требованиям продукта")
        if not age_ok:
            fit_missing.append("business_age")
            fit_recs.append(
                f"Требуется срок бизнеса от {product.min_business_age_months} мес."
            )
        fit_score = (sum(1 for x in fit_parts if x) / len(fit_parts)) * WEIGHTS["product_fit"]

    factors.append(
        {
            "key": "product_fit",
            "label": "Соответствие формальным требованиям продукта",
            "weight": WEIGHTS["product_fit"],
            "score": round(fit_score, 1),
            "max_score": float(WEIGHTS["product_fit"]),
            "missing": fit_missing,
            "recommendations": fit_recs,
        }
    )

    freshness_missing: list[str] = []
    freshness_recs: list[str] = []
    if financials is None:
        freshness_score = 0.0
        freshness_missing = ["financial_snapshot"]
    else:
        updated = getattr(financials, "updated_at", None)
        if updated is None:
            freshness_score = WEIGHTS["data_freshness"] * 0.5
        else:
            age_days = (datetime.utcnow().replace(tzinfo=None) - updated.replace(tzinfo=None)).days
            if age_days <= 30:
                freshness_score = float(WEIGHTS["data_freshness"])
            elif age_days <= 90:
                freshness_score = WEIGHTS["data_freshness"] * 0.6
                freshness_recs.append("Обновите финансовые данные — им больше 30 дней")
            else:
                freshness_score = WEIGHTS["data_freshness"] * 0.2
                freshness_recs.append("Финансовые данные устарели — загрузите свежую выписку")

    factors.append(
        {
            "key": "data_freshness",
            "label": "Актуальность предоставленных данных",
            "weight": WEIGHTS["data_freshness"],
            "score": round(freshness_score, 1),
            "max_score": float(WEIGHTS["data_freshness"]),
            "missing": freshness_missing,
            "recommendations": freshness_recs,
        }
    )

    total = int(round(sum(f["score"] for f in factors)))
    return {
        "score": min(100, max(0, total)),
        "factors": factors,
        "version": VERSION,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
