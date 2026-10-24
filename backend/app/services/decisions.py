from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ApplicationStatus, DecisionType, OfferStatus
from app.core.errors import AppError
from app.models.application import CreditApplication
from app.models.decision import CreditDecision, CreditOffer, OfferAcceptance
from app.models.policy import CreditPolicyVersion
from app.models.user import User
from app.services.finance_engine import annuity_payment, round2
from app.services.workflow import transition_application
from fastapi import status as http_status

DECISION_STATUSES = {
    ApplicationStatus.APPROVED: DecisionType.APPROVED,
    ApplicationStatus.REJECTED: DecisionType.REJECTED,
    ApplicationStatus.COUNTEROFFERED: DecisionType.COUNTEROFFERED,
}

PUBLIC_REASONS: dict[str, dict[str, str]] = {
    "APPROVED_BASE": {
        "title": "Параметры соответствуют тестовой политике",
        "details": "Предварительное демо-решение, не является офертой банка",
    },
    "DEBT_BURDEN_LIMIT": {
        "title": "Расчётная нагрузка выше тестового порога",
        "details": "Можно рассмотреть меньшую сумму или иной срок",
    },
    "AMOUNT_ADJUSTED": {
        "title": "Предложена скорректированная сумма",
        "details": "Альтернативные условия для демонстрации counter-offer",
    },
    "REJECT_POLICY": {
        "title": "Не соответствует тестовым критериям",
        "details": "Демо-отказ без раскрытия внутренних правил",
    },
    "NEED_INFO": {
        "title": "Недостаточно данных",
        "details": "Загрузите запрошенные документы и повторите отправку",
    },
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def latest_decision(app: CreditApplication) -> CreditDecision | None:
    decisions = sorted(app.decisions or [], key=lambda d: d.created_at or utcnow(), reverse=True)
    return decisions[0] if decisions else None


def _policy_label(db: Session, decision: CreditDecision) -> str | None:
    if decision.payload and decision.payload.get("policy_version"):
        return str(decision.payload["policy_version"])
    if decision.policy_version_id:
        ver = db.get(CreditPolicyVersion, decision.policy_version_id)
        if ver is not None:
            return f"policy-v{ver.version}"
    if decision.model_version:
        return decision.model_version
    return "policy-demo-v1"


def public_reason_codes(raw: list | None) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in raw or []:
        if isinstance(item, str):
            meta = PUBLIC_REASONS.get(item, {"title": item, "details": ""})
            out.append({"code": item, "title": meta["title"], "details": meta.get("details", "")})
        elif isinstance(item, dict) and item.get("code"):
            code = str(item["code"])
            meta = PUBLIC_REASONS.get(code, {})
            out.append(
                {
                    "code": code,
                    "title": str(item.get("title") or meta.get("title") or code),
                    "details": str(item.get("details") or meta.get("details") or ""),
                }
            )
    return out


def serialize_public_decision(db: Session, app: CreditApplication) -> dict[str, Any] | None:
    decision = latest_decision(app)
    if decision is None:
        return None
    return {
        "application_id": app.id,
        "decision": decision.decision_type,
        "decision_scope": (decision.payload or {}).get("decision_scope", "DEMO_PRELIMINARY"),
        "reason_codes": public_reason_codes(decision.reason_codes),
        "policy_version": _policy_label(db, decision),
        "updated_at": decision.created_at,
        "explanation": decision.explanation,
    }


def serialize_offer(offer: CreditOffer) -> dict[str, Any]:
    cond = offer.conditions or {}
    return {
        "id": offer.id,
        "application_id": offer.application_id,
        "decision_id": offer.decision_id,
        "product_id": offer.product_id,
        "amount": offer.amount,
        "term_months": offer.term_months,
        "rate": offer.rate,
        "monthly_payment": offer.monthly_payment,
        "currency": offer.currency or "RUB",
        "status": offer.status,
        "offer_version": int(cond.get("offer_version") or 1),
        "is_alternative": bool(cond.get("is_alternative")),
        "label": cond.get("label"),
        "expires_at": offer.expires_at,
        "created_at": offer.created_at,
        "conditions": {
            k: v
            for k, v in cond.items()
            if k in ("offer_version", "is_alternative", "label", "schedule_type")
        },
    }


def _supersede_active_offers(app: CreditApplication) -> None:
    for offer in app.offers or []:
        if offer.status == OfferStatus.ACTIVE:
            offer.status = OfferStatus.SUPERSEDED


def issue_decision(
    db: Session,
    *,
    app: CreditApplication,
    decision_type: DecisionType,
    actor: User | None,
    reason_codes: list[str] | None = None,
    explanation: str | None = None,
    counter_amount: Decimal | None = None,
) -> CreditDecision:
    _supersede_active_offers(app)

    if decision_type == DecisionType.APPROVED:
        codes = reason_codes or ["APPROVED_BASE"]
        explanation = explanation or "Предварительное одобрение на запрошенных условиях (демо)"
    elif decision_type == DecisionType.COUNTEROFFERED:
        codes = reason_codes or ["DEBT_BURDEN_LIMIT", "AMOUNT_ADJUSTED"]
        explanation = explanation or "Предложена альтернатива с меньшей суммой (демо)"
    elif decision_type == DecisionType.REJECTED:
        codes = reason_codes or ["REJECT_POLICY"]
        explanation = explanation or "Предварительный отказ по тестовой политике (демо)"
    else:
        codes = reason_codes or ["NEED_INFO"]
        explanation = explanation or "Требуется дополнительная информация"

    policy_ver = db.scalar(select(CreditPolicyVersion).order_by(CreditPolicyVersion.version.desc()).limit(1))

    decision = CreditDecision(
        application_id=app.id,
        decision_type=decision_type,
        decided_by=actor.id if actor else None,
        score=app.readiness_score,
        reason_codes=codes,
        explanation=explanation,
        factors={},  # не отдаём наружу
        model_version="demo-rules-v1",
        policy_version_id=policy_ver.id if policy_ver else None,
        payload={
            "decision_scope": "DEMO_PRELIMINARY",
            "policy_version": f"policy-v{policy_ver.version}" if policy_ver else "policy-demo-v1",
        },
    )
    db.add(decision)
    db.flush()

    expires = utcnow() + timedelta(days=14)
    rate = Decimal(str(app.rate or "18.5"))
    term = int(app.term_months)

    if decision_type == DecisionType.APPROVED:
        amount = Decimal(str(app.amount))
        payment = round2(annuity_payment(amount, rate, term))
        offer = CreditOffer(
            application_id=app.id,
            decision_id=decision.id,
            product_id=app.product_id,
            amount=amount,
            term_months=term,
            rate=rate,
            monthly_payment=payment,
            status=OfferStatus.ACTIVE,
            expires_at=expires,
            conditions={
                "offer_version": 1,
                "is_alternative": False,
                "label": "Основное предложение",
                "schedule_type": "annuity",
            },
        )
        db.add(offer)
        if app.offers is None:
            app.offers = [offer]
        else:
            app.offers.append(offer)
    elif decision_type == DecisionType.COUNTEROFFERED:
        base = Decimal(str(app.amount))
        amount = counter_amount or round2(base * Decimal("0.7"))
        if amount < Decimal("100000"):
            amount = min(base, Decimal("100000"))
        payment = round2(annuity_payment(amount, rate, term))
        offer = CreditOffer(
            application_id=app.id,
            decision_id=decision.id,
            product_id=app.product_id,
            amount=amount,
            term_months=term,
            rate=rate,
            monthly_payment=payment,
            status=OfferStatus.ACTIVE,
            expires_at=expires,
            conditions={
                "offer_version": 1,
                "is_alternative": True,
                "label": "Альтернативное предложение",
                "schedule_type": "annuity",
            },
        )
        db.add(offer)
        if app.offers is None:
            app.offers = [offer]
        else:
            app.offers.append(offer)

    if app.decisions is None:
        app.decisions = [decision]
    else:
        app.decisions.append(decision)
    db.flush()
    return decision


def ensure_decision_for_status(
    db: Session,
    app: CreditApplication,
    status: ApplicationStatus,
    actor: User | None,
) -> CreditDecision | None:
    dtype = DECISION_STATUSES.get(status)
    if dtype is None:
        return None
    existing = latest_decision(app)
    if existing and existing.decision_type == dtype:
        # уже есть актуальное решение этого типа
        return existing
    return issue_decision(db, app=app, decision_type=dtype, actor=actor)


def accept_offer(
    db: Session,
    *,
    app: CreditApplication,
    user: User,
    offer_id: str,
    offer_version: int,
    accepted_terms: bool,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    if not accepted_terms:
        raise AppError(
            "TERMS_NOT_ACCEPTED",
            "Необходимо принять условия предложения",
            status_code=http_status.HTTP_400_BAD_REQUEST,
        )

    offer = next((o for o in (app.offers or []) if o.id == offer_id), None)
    if offer is None:
        raise AppError("OFFER_NOT_FOUND", "Предложение не найдено", status_code=http_status.HTTP_404_NOT_FOUND)

    # Идемпотентность
    form = dict(app.form_data or {})
    if idempotency_key and form.get("accept_idempotency_key") == idempotency_key:
        return {
            "application_id": app.id,
            "offer_id": offer.id,
            "status": app.status,
            "next_step": app.current_step or "AGREEMENT_PREPARATION",
        }

    if offer.status == OfferStatus.ACCEPTED and offer.acceptance:
        return {
            "application_id": app.id,
            "offer_id": offer.id,
            "status": app.status,
            "next_step": app.current_step or "AGREEMENT_PREPARATION",
        }

    if offer.status == OfferStatus.EXPIRED or (
        offer.expires_at and offer.expires_at < utcnow()
    ):
        offer.status = OfferStatus.EXPIRED
        raise AppError(
            "OFFER_EXPIRED",
            "Срок действия предложения истёк",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "offer_id", "code": "OFFER_EXPIRED"}],
        )

    if offer.status != OfferStatus.ACTIVE:
        raise AppError(
            "OFFER_NOT_ACTIVE",
            f"Предложение недоступно (статус {offer.status.value})",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "status", "code": offer.status.value}],
        )

    # Уже принято другое
    other_accepted = next(
        (o for o in (app.offers or []) if o.status == OfferStatus.ACCEPTED and o.id != offer.id),
        None,
    )
    if other_accepted is not None:
        raise AppError(
            "OTHER_OFFER_ACCEPTED",
            "Уже принято другое предложение по этой заявке",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "offer_id", "code": "OTHER_OFFER_ACCEPTED"}],
        )

    version = int((offer.conditions or {}).get("offer_version") or 1)
    if offer_version != version:
        raise AppError(
            "OFFER_VERSION_MISMATCH",
            f"Версия предложения устарела: ожидали {version}, получили {offer_version}",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "offer_version", "code": "VERSION_MISMATCH"}],
        )

    if app.status not in (ApplicationStatus.APPROVED, ApplicationStatus.COUNTEROFFERED):
        raise AppError(
            "INVALID_TRANSITION",
            f"Нельзя принять предложение из статуса {app.status.value}",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    offer.status = OfferStatus.ACCEPTED
    for other in app.offers or []:
        if other.id != offer.id and other.status == OfferStatus.ACTIVE:
            other.status = OfferStatus.SUPERSEDED

    acceptance = OfferAcceptance(
        offer_id=offer.id,
        application_id=app.id,
        accepted_by=user.id,
        snapshot={
            "amount": str(offer.amount),
            "term_months": offer.term_months,
            "rate": str(offer.rate),
            "offer_version": version,
            "idempotency_key": idempotency_key,
        },
    )
    db.add(acceptance)

    transition_application(
        db,
        app,
        ApplicationStatus.OFFER_ACCEPTED,
        actor=user,
        comment="Клиент принял предложение",
    )
    transition_application(
        db,
        app,
        ApplicationStatus.AGREEMENT_PREPARATION,
        actor=user,
        comment="Переход к подготовке договора",
        bump_version=False,
    )

    if idempotency_key:
        form["accept_idempotency_key"] = idempotency_key
        form["accepted_offer_id"] = offer.id
        app.form_data = form

    db.flush()
    return {
        "application_id": app.id,
        "offer_id": offer.id,
        "status": app.status,
        "next_step": app.current_step or "AGREEMENT_PREPARATION",
    }


def decline_offer(
    db: Session,
    *,
    app: CreditApplication,
    user: User,
    offer_id: str,
    reason: str | None = None,
) -> CreditOffer:
    offer = next((o for o in (app.offers or []) if o.id == offer_id), None)
    if offer is None:
        raise AppError("OFFER_NOT_FOUND", "Предложение не найдено", status_code=http_status.HTTP_404_NOT_FOUND)

    if offer.status == OfferStatus.DECLINED:
        return offer

    if offer.status == OfferStatus.ACCEPTED:
        raise AppError(
            "OFFER_ALREADY_ACCEPTED",
            "Нельзя отклонить уже принятое предложение",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    if offer.status not in (OfferStatus.ACTIVE, OfferStatus.EXPIRED):
        raise AppError(
            "OFFER_NOT_ACTIVE",
            f"Предложение недоступно (статус {offer.status.value})",
            status_code=http_status.HTTP_409_CONFLICT,
        )

    offer.status = OfferStatus.DECLINED
    cond = dict(offer.conditions or {})
    if reason:
        cond["decline_reason"] = reason
    cond["declined_by"] = user.id
    offer.conditions = cond
    db.flush()
    return offer
