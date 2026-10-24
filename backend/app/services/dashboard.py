from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import ApplicationStatus, OfferStatus, ProductStatus
from app.models.application import CreditApplication, DocumentRequest
from app.models.company import Company
from app.models.credit import CreditProduct
from app.models.decision import CreditOffer
from app.models.finance import FinancialSnapshot
from app.models.funding import FundingNeed
from app.models.notification import Notification
from app.models.user import User

ACTIVE_APP_STATUSES = {
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.VALIDATING,
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.DOCS_REQUESTED,
    ApplicationStatus.APPROVED,
    ApplicationStatus.COUNTEROFFERED,
    ApplicationStatus.OFFER_ACCEPTED,
    ApplicationStatus.AGREEMENT_PREPARATION,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def build_dashboard(db: Session, company: Company, user: User) -> dict:
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company.id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )

    apps = list(
        db.scalars(
            select(CreditApplication)
            .where(CreditApplication.company_id == company.id)
            .order_by(CreditApplication.updated_at.desc())
            .limit(10)
        ).all()
    )
    apps_total = db.scalar(
        select(func.count()).select_from(CreditApplication).where(
            CreditApplication.company_id == company.id
        )
    ) or 0
    apps_active = db.scalar(
        select(func.count()).select_from(CreditApplication).where(
            CreditApplication.company_id == company.id,
            CreditApplication.status.in_(ACTIVE_APP_STATUSES),
        )
    ) or 0

    notifications = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(10)
        ).all()
    )
    unread = db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
        )
    ) or 0

    tasks = _build_tasks(db, company, apps)
    recommendations = _build_recommendations(db, company, snap)

    revenue = snap.avg_monthly_revenue if snap else None
    opex = snap.operating_expenses if snap else None
    net = None
    if revenue is not None and opex is not None:
        net = Decimal(str(revenue)) - Decimal(str(opex))

    return {
        "company": {
            "id": company.id,
            "name": company.name,
            "inn": company.inn,
            "legal_form": company.legal_form,
            "registry_status": company.registry_status,
            "region": company.region,
        },
        "kpi": {
            "period": snap.period if snap else None,
            "avg_monthly_revenue": revenue,
            "operating_expenses": opex,
            "cash_balance": snap.cash_balance if snap else None,
            "liabilities": snap.liabilities if snap else None,
            "active_credits": snap.active_credits if snap else None,
            "net_cashflow": net,
            "applications_total": int(apps_total),
            "applications_active": int(apps_active),
            "unread_notifications": int(unread),
            "open_tasks": len(tasks),
            "currency": "RUB",
        },
        "applications": [
            {
                "id": a.id,
                "status": a.status,
                "product_id": a.product_id,
                "product_name": a.product_name,
                "amount": a.amount,
                "term_months": a.term_months,
                "readiness_score": a.readiness_score,
                "updated_at": a.updated_at,
            }
            for a in apps
        ],
        "tasks": tasks,
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "is_read": n.is_read,
                "created_at": n.created_at,
                "payload": n.payload or {},
            }
            for n in notifications
        ],
        "recommendations": recommendations,
        "generated_at": _utcnow(),
    }


def _build_tasks(db: Session, company: Company, apps: list[CreditApplication]) -> list[dict]:
    tasks: list[dict] = []

    for app in apps:
        if app.status == ApplicationStatus.DRAFT:
            tasks.append(
                {
                    "id": f"task_submit_{app.id}",
                    "type": "SUBMIT_APPLICATION",
                    "title": f"Отправить черновик заявки {app.product_name or app.id}",
                    "priority": "HIGH",
                    "application_id": app.id,
                    "due_at": None,
                    "meta": {"amount": str(app.amount)},
                }
            )
        if app.status in (ApplicationStatus.APPROVED, ApplicationStatus.COUNTEROFFERED):
            offer = db.scalar(
                select(CreditOffer).where(
                    CreditOffer.application_id == app.id,
                    CreditOffer.status == OfferStatus.ACTIVE,
                )
            )
            if offer:
                tasks.append(
                    {
                        "id": f"task_offer_{offer.id}",
                        "type": "REVIEW_OFFER",
                        "title": f"Рассмотреть предложение {offer.amount} ₽",
                        "priority": "HIGH",
                        "application_id": app.id,
                        "due_at": offer.expires_at,
                        "meta": {"offer_id": offer.id, "rate": str(offer.rate)},
                    }
                )

    open_reqs = db.scalars(
        select(DocumentRequest)
        .join(CreditApplication, CreditApplication.id == DocumentRequest.application_id)
        .where(
            CreditApplication.company_id == company.id,
            DocumentRequest.status == "OPEN",
        )
        .order_by(DocumentRequest.created_at.desc())
        .limit(10)
    ).all()
    for req in open_reqs:
        tasks.append(
            {
                "id": f"task_doc_{req.id}",
                "type": "UPLOAD_DOCUMENT",
                "title": f"Загрузить документ: {req.doc_type}",
                "priority": "HIGH",
                "application_id": req.application_id,
                "due_at": req.due_at,
                "meta": {"document_request_id": req.id, "comment": req.comment},
            }
        )

    if company.registry_status != "ACTIVE":
        tasks.append(
            {
                "id": f"task_registry_{company.id}",
                "type": "REGISTRY_VERIFY",
                "title": "Проверить компанию в реестре",
                "priority": "MEDIUM",
                "application_id": None,
                "due_at": None,
                "meta": {"registry_status": company.registry_status},
            }
        )

    need = db.scalar(
        select(FundingNeed)
        .where(FundingNeed.company_id == company.id, FundingNeed.status == "ACTIVE")
        .order_by(FundingNeed.created_at.desc())
    )
    if need:
        linked = any(
            a.funding_need_id == need.id and a.status != ApplicationStatus.REJECTED for a in apps
        )
        if not linked:
            tasks.append(
                {
                    "id": f"task_need_{need.id}",
                    "type": "CREATE_APPLICATION",
                    "title": f"Подобрать кредит под цель «{need.title}»",
                    "priority": "MEDIUM",
                    "application_id": None,
                    "due_at": None,
                    "meta": {"funding_need_id": need.id, "amount": str(need.required_amount)},
                }
            )

    priority_rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    tasks.sort(key=lambda t: priority_rank.get(t["priority"], 9))
    return tasks[:15]


def _build_recommendations(
    db: Session, company: Company, snap: FinancialSnapshot | None
) -> list[dict]:
    products = list(
        db.scalars(
            select(CreditProduct)
            .where(
                CreditProduct.is_active.is_(True),
                CreditProduct.status == ProductStatus.PUBLISHED,
            )
            .order_by(CreditProduct.rate_min)
            .limit(5)
        ).all()
    )
    if not products:
        return []

    revenue = Decimal(str(snap.avg_monthly_revenue)) if snap else Decimal("0")
    out: list[dict] = []
    for i, p in enumerate(products):
        # простой демо-скор: ниже ставка / подходит по обороту
        score = 90.0 - i * 8
        if revenue and Decimal(str(p.amount_min)) > revenue * 20:
            score -= 15
        if company.legal_form.value not in (p.legal_forms or []):
            score -= 25
        score = max(10.0, min(99.0, score))
        out.append(
            {
                "product_id": p.id,
                "product_name": p.name,
                "score": score,
                "reason": f"Демо-подбор: ставка от {p.rate_min}%, срок до {p.term_max} мес.",
                "amount_hint": p.amount_min,
            }
        )
    out.sort(key=lambda x: x["score"], reverse=True)
    return out[:3]
