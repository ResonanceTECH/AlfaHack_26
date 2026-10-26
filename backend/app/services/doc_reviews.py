"""Assign teammates to review application / decision documents."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.application import CreditApplication
from app.models.company import CompanyMembership
from app.models.doc_review import DocumentReview
from app.models.user import User
from app.services.company_tasks import create_task
from app.services.notifications import notify

VALID_STATUS = {"pending", "viewed", "approved", "rejected"}
VALID_PURPOSE = {"review", "approve"}
VALID_KIND = {
    "app_slot",
    "app_document",
    "company_document",
    "decision_report",
    "pack",
    "agreement",
}


def serialize_review(r: DocumentReview) -> dict[str, Any]:
    assignee = getattr(r, "assignee", None)
    assigner = getattr(r, "assigner", None)
    return {
        "id": r.id,
        "company_id": r.company_id,
        "application_id": r.application_id,
        "document_id": r.document_id,
        "company_document_id": r.company_document_id,
        "kind": r.kind,
        "slot_key": r.slot_key,
        "title": r.title,
        "file_name": r.file_name,
        "assignee_user_id": r.assignee_user_id,
        "assignee_name": assignee.full_name if assignee else None,
        "assignee_email": assignee.email if assignee else None,
        "assigned_by": r.assigned_by,
        "assigned_by_name": assigner.full_name if assigner else None,
        "purpose": r.purpose,
        "status": r.status,
        "task_id": r.task_id,
        "comment": r.comment,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _require_member(db: Session, company_id: str, user_id: str) -> None:
    m = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    if m is None:
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Исполнитель должен быть участником команды",
        )


def list_reviews(
    db: Session,
    *,
    company_id: str,
    mine_user_id: str | None = None,
    application_id: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    q = (
        select(DocumentReview)
        .options(
            selectinload(DocumentReview.assignee),
            selectinload(DocumentReview.assigner),
        )
        .where(DocumentReview.company_id == company_id)
        .order_by(DocumentReview.created_at.desc())
    )
    if mine_user_id:
        q = q.where(DocumentReview.assignee_user_id == mine_user_id)
    if application_id:
        q = q.where(DocumentReview.application_id == application_id)
    if status:
        q = q.where(DocumentReview.status == status.lower())
    return [serialize_review(r) for r in db.scalars(q).all()]


def assign_reviews(
    db: Session,
    *,
    company_id: str,
    actor: User,
    assignee_user_id: str,
    application_id: str | None,
    purpose: str,
    items: list[dict[str, Any]],
    due_days: int = 3,
) -> list[DocumentReview]:
    purpose = (purpose or "review").lower()
    if purpose not in VALID_PURPOSE:
        raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректная цель")
    if not items:
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Укажите хотя бы один документ для проверки",
        )
    _require_member(db, company_id, assignee_user_id)

    app = None
    if application_id:
        app = db.get(CreditApplication, application_id)
        if app is None or app.company_id != company_id:
            raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")

    due = date.today() + timedelta(days=due_days)
    app_label = (app.product_name if app else None) or (application_id[:8] if application_id else "")
    task_title = (
        f"Проверить документы заявки «{app_label}»"
        if application_id
        else "Проверить документы компании"
    )
    desc_lines = [f"Назначено: {actor.full_name or actor.email}"]
    for it in items[:12]:
        desc_lines.append(f"• {it.get('title') or 'Документ'}")
    if len(items) > 12:
        desc_lines.append(f"… и ещё {len(items) - 12}")

    # One rich notification below — skip create_task's generic TEAM_TASK ping
    task = create_task(
        db,
        company_id=company_id,
        actor=actor,
        title=task_title,
        description="\n".join(desc_lines),
        assignee_user_id=assignee_user_id,
        due_date=due,
        status="todo",
        notify_assignee=False,
    )

    created: list[DocumentReview] = []
    for it in items:
        kind = str(it.get("kind") or "app_slot").lower()
        if kind not in VALID_KIND:
            kind = "app_slot"
        title = str(it.get("title") or "Документ").strip()
        review = DocumentReview(
            company_id=company_id,
            application_id=application_id,
            document_id=it.get("document_id"),
            company_document_id=it.get("company_document_id"),
            kind=kind,
            slot_key=it.get("slot_key"),
            title=title,
            file_name=it.get("file_name"),
            assignee_user_id=assignee_user_id,
            assigned_by=actor.id,
            purpose=purpose,
            status="pending",
            task_id=task.id,
            meta={"due_date": due.isoformat()},
        )
        db.add(review)
        created.append(review)

    db.flush()

    actor_name = actor.full_name or actor.email or "Коллега"
    due_label = due.strftime("%d.%m.%Y")
    n_files = len(created)
    notify(
        db,
        user_id=assignee_user_id,
        type="DOC_REVIEW_ASSIGNED",
        title=f"{actor_name} назначил(а) проверку документов",
        body=(
            f"{actor_name} дал(а) вам действие: {task_title} "
            f"({n_files} файл(ов), до {due_label}). "
            "Календарь, «Команда → Задачи» и «Документы → На проверке»."
        ),
        payload={
            "company_id": company_id,
            "application_id": application_id,
            "task_id": task.id,
            "obligation_id": task.obligation_id,
            "review_ids": [r.id for r in created],
            "count": n_files,
            "due_date": due.isoformat(),
            "assigned_by": actor.id,
            "assigned_by_name": actor_name,
        },
    )
    db.flush()
    return created


def patch_review(
    db: Session,
    *,
    company_id: str,
    review_id: str,
    actor: User,
    status: str | None = None,
    comment: str | None = None,
) -> DocumentReview:
    review = db.scalar(
        select(DocumentReview)
        .options(
            selectinload(DocumentReview.assignee),
            selectinload(DocumentReview.assigner),
        )
        .where(DocumentReview.id == review_id, DocumentReview.company_id == company_id)
    )
    if review is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Назначение не найдено")

    # Assignee or assigner / any company member with write can update — keep simple: assignee or assigner
    if actor.id not in {review.assignee_user_id, review.assigned_by}:
        m = db.scalar(
            select(CompanyMembership).where(
                CompanyMembership.company_id == company_id,
                CompanyMembership.user_id == actor.id,
            )
        )
        if m is None:
            raise HTTPException(http_status.HTTP_403_FORBIDDEN, detail="Нет доступа")

    if status is not None:
        st = status.strip().lower()
        if st not in VALID_STATUS:
            raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректный статус")
        review.status = st
    if comment is not None:
        review.comment = comment

    db.flush()

    # Notify assigner on approve/reject (+ comment for owner to fix or finalize)
    if status in ("approved", "rejected") and review.assigned_by and review.assigned_by != actor.id:
        actor_label = actor.full_name or actor.email or "Коллега"
        note = (review.comment or "").strip()
        if (review.kind or "").lower() == "agreement":
            if status == "approved":
                title = "Рекомендация по договору"
                body = f"{actor_label} рекомендовал(а) согласовать «{review.title}». Финал — за вами."
            else:
                title = "Замечания по договору"
                body = f"{actor_label} отправил(а) договор на доработку: «{review.title}»."
        else:
            if status == "approved":
                title = "Документ согласован"
                body = f"{actor_label} подтвердил(а) корректность «{review.title}»."
            else:
                title = "Документ на доработку"
                body = f"{actor_label} отправил(а) «{review.title}» на доработку."
        if note:
            body = f"{body} Комментарий: {note}"
        notify(
            db,
            user_id=review.assigned_by,
            type="DOC_REVIEW_RESULT",
            title=title,
            body=body,
            payload={
                "company_id": company_id,
                "application_id": review.application_id,
                "review_id": review.id,
                "status": review.status,
                "kind": review.kind,
                "comment": note or None,
            },
        )

    # If all reviews for task are done → mark task done
    if review.task_id and status in ("approved", "rejected"):
        siblings = list(
            db.scalars(
                select(DocumentReview).where(DocumentReview.task_id == review.task_id)
            ).all()
        )
        if siblings and all(s.status in ("approved", "rejected") for s in siblings):
            from app.models.task import CompanyTask

            task = db.get(CompanyTask, review.task_id)
            if task is not None:
                task.status = "done"
                db.flush()

    return review


def ensure_decision_report_review(
    db: Session,
    *,
    app: CreditApplication,
    actor: User | None,
) -> DocumentReview | None:
    """
    After bank decision / offer accept: ask the same pack reviewer (or leave for owner)
    to re-check the decision report.
    """
    if not app.company_id:
        return None

    existing = db.scalar(
        select(DocumentReview).where(
            DocumentReview.company_id == app.company_id,
            DocumentReview.application_id == app.id,
            DocumentReview.kind == "decision_report",
            DocumentReview.status == "pending",
        )
    )
    if existing is not None:
        return existing

    # Prefer assignee of latest pack for this application
    prior = db.scalar(
        select(DocumentReview)
        .where(
            DocumentReview.company_id == app.company_id,
            DocumentReview.application_id == app.id,
            DocumentReview.kind != "decision_report",
        )
        .order_by(DocumentReview.created_at.desc())
        .limit(1)
    )
    assignee_id = prior.assignee_user_id if prior else None
    if not assignee_id and actor:
        assignee_id = actor.id
    if not assignee_id:
        return None

    product = (app.product_name or "Кредит").strip()
    items = [
        {
            "kind": "decision_report",
            "slot_key": "decision",
            "title": f"Решение банка / отчёт — {product}",
            "file_name": "credit_decision_report.pdf",
        }
    ]
    actor_user = actor or db.get(User, assignee_id)
    if actor_user is None:
        return None
    created = assign_reviews(
        db,
        company_id=app.company_id,
        actor=actor_user,
        assignee_user_id=assignee_id,
        application_id=app.id,
        purpose="approve",
        items=items,
        due_days=2,
    )
    return created[0] if created else None
