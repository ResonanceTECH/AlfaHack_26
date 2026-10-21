from __future__ import annotations

import hashlib
import io
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pandas as pd

from app.core.enums import TransactionCategory
from app.services.finance_engine import round2

REVENUE_HINTS = re.compile(
    r"оплат|выручк|реализац|поступл|invoice|payment from|перевод от клиент",
    re.I,
)
SALARY_HINTS = re.compile(r"зарплат|з/п|фоп|ФОТ|salary|начислен", re.I)
TAX_HINTS = re.compile(r"налог|усн|ндс|ндфл|фнс|страхов", re.I)
RENT_HINTS = re.compile(r"аренда|rent", re.I)
LOAN_IN_HINTS = re.compile(r"кредит|заём|заем|транш|овердрафт.*зачисл", re.I)
LOAN_OUT_HINTS = re.compile(r"погашен.*кредит|процент.*кредит|платёж по кредит", re.I)
TRANSFER_HINTS = re.compile(r"между своими|перевод собств|внутренн", re.I)
SUPPLIER_HINTS = re.compile(r"поставщик|оплата по договор|товар", re.I)

def classify_purpose(purpose: str, direction: str, amount: Decimal) -> TransactionCategory:
    text = purpose or ""
    if TRANSFER_HINTS.search(text):
        return TransactionCategory.TRANSFER_INTERNAL
    if LOAN_IN_HINTS.search(text) and direction == "in":
        return TransactionCategory.LOAN_IN
    if LOAN_OUT_HINTS.search(text) and direction == "out":
        return TransactionCategory.LOAN_OUT
    if SALARY_HINTS.search(text):
        return TransactionCategory.SALARY
    if TAX_HINTS.search(text):
        return TransactionCategory.TAX
    if RENT_HINTS.search(text):
        return TransactionCategory.RENT
    if SUPPLIER_HINTS.search(text) and direction == "out":
        return TransactionCategory.SUPPLIER
    if direction == "in" and REVENUE_HINTS.search(text):
        return TransactionCategory.REVENUE
    if direction == "in":
        return TransactionCategory.REVENUE
    if direction == "out":
        return TransactionCategory.OPEX
    return TransactionCategory.OTHER

def tx_hash(company_id: str, tx_date: date, amount: Decimal, purpose: str, counterparty: str) -> str:
    raw = f"{company_id}|{tx_date.isoformat()}|{amount}|{purpose.strip().lower()}|{counterparty.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    col_map: dict[str, str] = {}
    for c in df.columns:
        key = str(c).strip().lower()
        if key in ("дата", "date", "operation date", "дата операции"):
            col_map[c] = "date"
        elif key in ("сумма", "amount", "сумма операции"):
            col_map[c] = "amount"
        elif key in ("дебет", "debit", "списание"):
            col_map[c] = "debit"
        elif key in ("кредит", "credit", "зачисление", "поступление"):
            col_map[c] = "credit"
        elif key in ("назначение", "purpose", "назначение платежа", "описание"):
            col_map[c] = "purpose"
        elif key in ("контрагент", "counterparty", "плательщик", "получатель"):
            col_map[c] = "counterparty"
        elif key in ("остаток", "balance"):
            col_map[c] = "balance"
    return df.rename(columns=col_map)

def parse_statement_bytes(content: bytes, filename: str) -> list[dict[str, Any]]:
    name = filename.lower()
    if not re.search(r"\.(csv|xlsx|xls)$", name):
        raise ValueError("Поддерживаются только CSV и XLSX. PDF — на следующем этапе.")

    if name.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), sep=None, engine="python")
    else:
        df = pd.read_excel(io.BytesIO(content))

    if df.empty:
        raise ValueError("Файл пуст или не содержит строк операций")

    df = _normalize_columns(df)
    rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        try:
            raw_date = row.get("date")
            if pd.isna(raw_date):
                continue
            if isinstance(raw_date, datetime):
                tx_date = raw_date.date()
            elif isinstance(raw_date, date):
                tx_date = raw_date
            else:
                tx_date = pd.to_datetime(str(raw_date), dayfirst=True).date()

            purpose = str(row.get("purpose", "") or "")
            counterparty = str(row.get("counterparty", "") or "")
            balance_raw = row.get("balance")
            balance = None if pd.isna(balance_raw) else Decimal(str(balance_raw).replace(",", ".").replace(" ", ""))

            if "amount" in df.columns and not pd.isna(row.get("amount")):
                amount_val = Decimal(str(row["amount"]).replace(",", ".").replace(" ", "").replace("\xa0", ""))
                direction = "in" if amount_val >= 0 else "out"
                amount = abs(amount_val)
            elif "debit" in df.columns or "credit" in df.columns:
                debit = row.get("debit", 0)
                credit = row.get("credit", 0)
                debit_v = Decimal("0") if pd.isna(debit) or debit == "" else Decimal(str(debit).replace(",", ".").replace(" ", ""))
                credit_v = Decimal("0") if pd.isna(credit) or credit == "" else Decimal(str(credit).replace(",", ".").replace(" ", ""))
                if credit_v > 0:
                    amount, direction = credit_v, "in"
                elif debit_v > 0:
                    amount, direction = debit_v, "out"
                else:
                    continue
            else:
                continue

            category = classify_purpose(purpose, direction, amount)
            rows.append(
                {
                    "date": tx_date,
                    "amount": round2(amount),
                    "direction": direction,
                    "counterparty": counterparty,
                    "purpose": purpose,
                    "category": category,
                    "balance": balance,
                }
            )
        except Exception:
            continue

    if not rows:
        raise ValueError(
            "Не удалось распознать операции. Ожидаются колонки: дата, сумма "
            "(или дебет/кредит), назначение, контрагент."
        )
    return rows

def build_import_result(company_id: str, parsed: list[dict[str, Any]]) -> dict[str, Any]:
    transactions = []
    for p in parsed:
        h = tx_hash(company_id, p["date"], p["amount"], p["purpose"], p["counterparty"])
        transactions.append(
            {
                "id": str(uuid4()),
                "date": p["date"],
                "amount": p["amount"],
                "direction": p["direction"],
                "counterparty": p["counterparty"],
                "purpose": p["purpose"],
                "category": p["category"],
                "balance": p.get("balance"),
                "external_hash": h,
            }
        )

    external = [t for t in transactions if t["category"] != TransactionCategory.TRANSFER_INTERNAL]
    internal = [t for t in transactions if t["category"] == TransactionCategory.TRANSFER_INTERNAL]

    inflow = sum(
        (t["amount"] for t in external if t["direction"] == "in" and t["category"] == TransactionCategory.REVENUE),
        Decimal("0"),
    )
    outflow = sum((t["amount"] for t in external if t["direction"] == "out"), Decimal("0"))

    monthly: dict[str, dict[str, Decimal]] = {}
    for t in external:
        m = t["date"].strftime("%Y-%m")
        cur = monthly.setdefault(m, {"inflow": Decimal("0"), "outflow": Decimal("0")})
        if t["direction"] == "in" and t["category"] not in (
            TransactionCategory.LOAN_IN,
            TransactionCategory.TRANSFER_INTERNAL,
        ):
            cur["inflow"] += t["amount"]
        elif t["direction"] == "out":
            cur["outflow"] += t["amount"]

    purpose_counts: dict[str, int] = {}
    for t in external:
        key = f"{t['purpose'][:40]}|{t['amount']}"
        purpose_counts[key] = purpose_counts.get(key, 0) + 1
    recurring = sum(1 for v in purpose_counts.values() if v >= 2)

    dates = [t["date"] for t in transactions]
    return {
        "id": str(uuid4()),
        "period_from": min(dates),
        "period_to": max(dates),
        "transactions": transactions,
        "summary": {
            "total_inflow": round2(inflow),
            "total_outflow": round2(outflow),
            "net_cash_flow": round2(inflow - outflow),
            "excluded_internal_transfers": len(internal),
            "recurring_payments": recurring,
        },
        "monthly": [
            {"month": k, "inflow": round2(v["inflow"]), "outflow": round2(v["outflow"])}
            for k, v in sorted(monthly.items())
        ],
    }
