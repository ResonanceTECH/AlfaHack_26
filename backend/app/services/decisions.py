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
from app.services.notifications import notify
from app.services.workflow import transition_application
from fastapi import status as http_status

_DECISION_NOTIFY = {
    DecisionType.APPROVED: ("DECISION_APPROVED", "Предварительное одобрение"),
    DecisionType.REJECTED: ("DECISION_REJECTED", "Предварительный отказ"),
    DecisionType.COUNTEROFFERED: ("DECISION_COUNTEROFFER", "Альтернативное предложение"),
    DecisionType.NEED_INFO: ("DECISION_NEED_INFO", "Требуются дополнительные данные"),
}

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
    offer_amount: Decimal | None = None,
    offer_term_months: int | None = None,
    offer_rate: Decimal | None = None,
    product_id: str | None = None,
    offer_label: str | None = None,
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
    rate = Decimal(str(offer_rate if offer_rate is not None else app.rate or "18.5"))
    term = int(offer_term_months if offer_term_months is not None else app.term_months)
    pid = product_id or app.product_id

    def _add_offer(
        *,
        amount: Decimal,
        is_alternative: bool,
        label: str,
        version: int = 1,
    ) -> CreditOffer:
        payment = round2(annuity_payment(amount, rate, term))
        offer = CreditOffer(
            application_id=app.id,
            decision_id=decision.id,
            product_id=pid,
            amount=amount,
            term_months=term,
            rate=rate,
            monthly_payment=payment,
            status=OfferStatus.ACTIVE,
            expires_at=expires,
            conditions={
                "offer_version": version,
                "is_alternative": is_alternative,
                "label": label,
                "schedule_type": "annuity",
            },
        )
        db.add(offer)
        if app.offers is None:
            app.offers = [offer]
        else:
            app.offers.append(offer)
        return offer

    if decision_type == DecisionType.APPROVED:
        amount = Decimal(str(offer_amount if offer_amount is not None else app.amount))
        _add_offer(
            amount=amount,
            is_alternative=False,
            label=offer_label or "Основное предложение",
        )
    elif decision_type == DecisionType.COUNTEROFFERED:
        base = Decimal(str(app.amount))
        amount = Decimal(
            str(
                offer_amount
                if offer_amount is not None
                else counter_amount
                if counter_amount is not None
                else round2(base * Decimal("0.7"))
            )
        )
        if amount < Decimal("100000"):
            amount = min(base, Decimal("100000"))
        _add_offer(
            amount=amount,
            is_alternative=True,
            label=offer_label or "Альтернативное предложение",
        )

    if app.decisions is None:
        app.decisions = [decision]
    else:
        app.decisions.append(decision)
    db.flush()

    if app.created_by:
        ntype, ntitle = _DECISION_NOTIFY.get(
            decision_type, ("DECISION_UPDATE", "Обновление по заявке")
        )
        notify(
            db,
            user_id=app.created_by,
            type=ntype,
            title=ntitle,
            body=explanation,
            payload={
                "application_id": app.id,
                "company_id": app.company_id,
                "decision": decision_type.value,
            },
        )
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


PROPOSE_ALLOWED_FROM: set[ApplicationStatus] = {
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.VALIDATING,
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.DOCS_REQUESTED,
    ApplicationStatus.COUNTEROFFERED,
    ApplicationStatus.APPROVED,
}

DECISION_TO_STATUS: dict[DecisionType, ApplicationStatus] = {
    DecisionType.APPROVED: ApplicationStatus.APPROVED,
    DecisionType.REJECTED: ApplicationStatus.REJECTED,
    DecisionType.COUNTEROFFERED: ApplicationStatus.COUNTEROFFERED,
    DecisionType.NEED_INFO: ApplicationStatus.DOCS_REQUESTED,
}


def propose_decision(
    db: Session,
    *,
    app: CreditApplication,
    analyst: User,
    decision_type: DecisionType,
    reason_codes: list[str] | None = None,
    explanation: str | None = None,
    comment: str | None = None,
    offer_amount: Decimal | None = None,
    offer_term_months: int | None = None,
    offer_rate: Decimal | None = None,
    product_id: str | None = None,
    offer_label: str | None = None,
) -> tuple[CreditDecision, CreditOffer | None, dict[str, Any]]:
    if decision_type not in (
        DecisionType.APPROVED,
        DecisionType.REJECTED,
        DecisionType.COUNTEROFFERED,
        DecisionType.NEED_INFO,
    ):
        raise AppError(
            "UNSUPPORTED_DECISION",
            f"Тип решения {decision_type.value} не поддерживается в propose",
            status_code=http_status.HTTP_400_BAD_REQUEST,
        )

    if app.status not in PROPOSE_ALLOWED_FROM:
        raise AppError(
            "INVALID_TRANSITION",
            f"Нельзя вынести решение из статуса {app.status.value}",
            status_code=http_status.HTTP_409_CONFLICT,
            fields=[{"field": "status", "code": app.status.value}],
        )

    if decision_type == DecisionType.COUNTEROFFERED and offer_amount is None and app.amount:
        # явный counter без суммы — ок, issue_decision возьмёт 70%
        pass
    if decision_type == DecisionType.COUNTEROFFERED and offer_amount is not None:
        if Decimal(str(offer_amount)) <= 0:
            raise AppError(
                "VALIDATION_ERROR",
                "offer_amount должен быть > 0",
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                fields=[{"field": "offer_amount", "code": "GT_ZERO"}],
            )

    target_status = DECISION_TO_STATUS[decision_type]
    note = comment or explanation or f"Решение аналитика: {decision_type.value}"

    if app.assigned_analyst_id is None:
        app.assigned_analyst_id = analyst.id
    if app.assigned_manager_id is None:
        app.assigned_manager_id = analyst.id

    # NEED_INFO при уже DOCS_REQUESTED — только decision + notify, без transition
    if app.status != target_status:
        transition_application(db, app, target_status, actor=analyst, comment=note)

    if decision_type == DecisionType.REJECTED:
        app.rejection_reason = explanation or note

    decision = issue_decision(
        db,
        app=app,
        decision_type=decision_type,
        actor=analyst,
        reason_codes=reason_codes,
        explanation=explanation or note,
        offer_amount=offer_amount,
        offer_term_months=offer_term_months,
        offer_rate=offer_rate,
        product_id=product_id,
        offer_label=offer_label,
    )

    offer = next(
        (o for o in (app.offers or []) if o.decision_id == decision.id and o.status == OfferStatus.ACTIVE),
        None,
    )
    payload = {
        "application_id": app.id,
        "status": app.status,
        "current_step": app.current_step,
        "decision_id": decision.id,
        "decision_type": decision.decision_type,
        "offer_id": offer.id if offer else None,
        "reason_codes": decision.reason_codes or [],
        "explanation": decision.explanation,
    }
    return decision, offer, payload


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

    notify(
        db,
        user_id=user.id,
        type="OFFER_ACCEPTED",
        title="Предложение принято",
        body="Готовим демонстрационный договор. Это не юридически значимое соглашение.",
        payload={"application_id": app.id, "offer_id": offer.id, "company_id": app.company_id},
    )
    if app.assigned_analyst_id and app.assigned_analyst_id != user.id:
        notify(
            db,
            user_id=app.assigned_analyst_id,
            type="OFFER_ACCEPTED_ANALYST",
            title="Клиент принял предложение",
            body=f"Заявка {app.id[:8]}… — предложение принято",
            payload={"application_id": app.id, "offer_id": offer.id},
        )

    # Calendar: full payment schedule + «первый платёж» notification
    from app.services.loan_calendar import seed_loan_schedule_obligations

    seed_loan_schedule_obligations(
        db,
        app=app,
        offer=offer,
        notify_user_ids=[user.id],
    )

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
