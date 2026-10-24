from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.funding import FundingNeed, FundingNeedItem
from app.services.finance_engine import calc_required_amount, round2


def costs_from_items(items: list[dict] | list[FundingNeedItem]) -> dict[str, Decimal]:
    costs: dict[str, Decimal] = {}
    for i, item in enumerate(items):
        if isinstance(item, FundingNeedItem):
            name, amount, qty = item.name, item.amount, item.quantity
        else:
            name = item["name"]
            amount = item["amount"]
            qty = item.get("quantity", 1)
        key = name.strip() or f"item_{i + 1}"
        line = round2(Decimal(str(amount)) * Decimal(int(qty)))
        costs[key] = round2(costs.get(key, Decimal("0")) + line)
    return costs


def recompute_required(
    *,
    costs: dict[str, Decimal | str | float | int],
    reserve: Decimal,
    own_funds: Decimal,
    other_funding: Decimal,
    override: Decimal | None = None,
) -> Decimal:
    if override is not None:
        return round2(Decimal(str(override)))
    normalized = {k: Decimal(str(v)) for k, v in costs.items()}
    return calc_required_amount(normalized, reserve, own_funds, other_funding)


def serialize_need(need: FundingNeed) -> dict:
    costs = {k: Decimal(str(v)) for k, v in (need.costs or {}).items()}
    return {
        "id": need.id,
        "company_id": need.company_id,
        "goal_type": need.goal_type,
        "title": need.title,
        "description": need.description,
        "costs": costs,
        "items": [
            {
                "id": it.id,
                "need_id": it.need_id,
                "name": it.name,
                "amount": it.amount,
                "quantity": it.quantity,
                "unit": it.unit,
                "meta": it.meta or {},
                "created_at": it.created_at,
            }
            for it in (need.items or [])
        ],
        "reserve": need.reserve,
        "own_funds": need.own_funds,
        "other_funding": need.other_funding,
        "required_amount": need.required_amount,
        "target_date": need.target_date,
        "term_months": need.term_months,
        "urgency": need.urgency,
        "status": need.status,
        "currency": need.currency,
        "created_at": need.created_at,
        "updated_at": need.updated_at,
    }


def load_need(db: Session, need_id: str) -> FundingNeed | None:
    return db.scalar(
        select(FundingNeed)
        .options(joinedload(FundingNeed.items))
        .where(FundingNeed.id == need_id)
    )


def replace_items(db: Session, need: FundingNeed, items: list[dict]) -> None:
    for existing in list(need.items):
        db.delete(existing)
    db.flush()
    for raw in items:
        db.add(
            FundingNeedItem(
                need_id=need.id,
                name=raw["name"].strip(),
                amount=raw["amount"],
                quantity=raw.get("quantity", 1),
                unit=raw.get("unit"),
                meta=raw.get("meta") or {},
            )
        )
    db.flush()
