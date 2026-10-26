from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company, CompanyMembership
from app.models.finance import FinancialObligation
from app.models.task import CompanyTask
from app.models.user import User
from app.services.notifications import notify

VALID_STATUSES = {"todo", "in_progress", "done"}


def _require_member(db: Session, company_id: str, user_id: str | None) -> User | None:
    if not user_id:
        return None
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Исполнитель должен быть участником компании",
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user


def serialize_task(task: CompanyTask) -> dict[str, Any]:
    assignee = getattr(task, "assignee", None)
    creator = getattr(task, "creator", None)
    return {
        "id": task.id,
        "company_id": task.company_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "assignee_user_id": task.assignee_user_id,
        "assignee_name": assignee.full_name if assignee else None,
        "assignee_email": assignee.email if assignee else None,
        "created_by": task.created_by,
        "created_by_name": creator.full_name if creator else None,
        "due_date": task.due_date,
        "obligation_id": task.obligation_id,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def list_tasks(db: Session, company_id: str) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(CompanyTask)
            .options(
                selectinload(CompanyTask.assignee),
                selectinload(CompanyTask.creator),
            )
            .where(CompanyTask.company_id == company_id)
            .order_by(CompanyTask.due_date.nulls_last(), CompanyTask.created_at.desc())
        ).all()
    )
    return [serialize_task(t) for t in rows]


def _sync_calendar_obligation(db: Session, task: CompanyTask) -> None:
    """Mirror task deadline into financial_obligations (type=task) for calendar/.ics."""
    if task.due_date is None or task.status == "done":
        if task.obligation_id:
            ob = db.get(FinancialObligation, task.obligation_id)
            if ob is not None:
                if task.status == "done":
                    ob.status = "paid"
                    ob.title = task.title
                else:
                    db.delete(ob)
                    task.obligation_id = None
        return

    meta = {
        "currency": "RUB",
        "task_id": task.id,
        "kind": "team_task",
        "assignee_user_id": task.assignee_user_id,
    }
    if task.obligation_id:
        ob = db.get(FinancialObligation, task.obligation_id)
        if ob is not None:
            ob.title = f"Задача: {task.title}"
            ob.due_date = task.due_date
            ob.type = "task"
            ob.status = "planned"
            ob.amount = Decimal("0")
            ob.meta = meta
            return

    ob = FinancialObligation(
        company_id=task.company_id,
        type="task",
        title=f"Задача: {task.title}",
        amount=Decimal("0"),
        due_date=task.due_date,
        recurring=False,
        status="planned",
        meta=meta,
    )
    db.add(ob)
    db.flush()
    task.obligation_id = ob.id


def _notify_assignee(
    db: Session,
    *,
    task: CompanyTask,
    actor: User,
    company_name: str,
    is_new: bool,
) -> None:
    if not task.assignee_user_id or task.assignee_user_id == actor.id:
        return
    due = task.due_date.isoformat() if task.due_date else None
    verb = "назначена" if is_new else "обновлена"
    body_parts = [f'Вам {verb} задача «{task.title}» в «{company_name}».']
    if due:
        body_parts.append(f"Дедлайн: {due}.")
    body_parts.append("Откройте «Команда → Совместные задачи».")
    notify(
        db,
        user_id=task.assignee_user_id,
        type="TEAM_TASK",
        title=f"Задача: {task.title}",
        body=" ".join(body_parts),
        payload={
            "task_id": task.id,
            "company_id": task.company_id,
            "company_name": company_name,
            "due_date": due,
            "status": task.status,
            "assigned_by": actor.id,
            "assigned_by_name": actor.full_name,
        },
    )


def create_task(
    db: Session,
    *,
    company_id: str,
    actor: User,
    title: str,
    description: str | None,
    assignee_user_id: str | None,
    due_date: date | None,
    status: str = "todo",
) -> CompanyTask:
    status = (status or "todo").strip().lower()
    if status not in VALID_STATUSES:
        raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректный статус")
    _require_member(db, company_id, assignee_user_id)
    company = db.get(Company, company_id)
    company_name = company.name if company else "компанию"

    task = CompanyTask(
        company_id=company_id,
        title=title.strip(),
        description=description,
        status=status,
        assignee_user_id=assignee_user_id,
        created_by=actor.id,
        due_date=due_date,
    )
    db.add(task)
    db.flush()
    _sync_calendar_obligation(db, task)
    _notify_assignee(db, task=task, actor=actor, company_name=company_name, is_new=True)
    db.flush()
    return task


def update_task(
    db: Session,
    *,
    task: CompanyTask,
    actor: User,
    patch: dict[str, Any],
) -> CompanyTask:
    prev_assignee = task.assignee_user_id
    if "title" in patch and patch["title"] is not None:
        task.title = str(patch["title"]).strip()
    if "description" in patch:
        task.description = patch["description"]
    if "due_date" in patch:
        task.due_date = patch["due_date"]
    if "status" in patch and patch["status"] is not None:
        st = str(patch["status"]).strip().lower()
        if st not in VALID_STATUSES:
            raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректный статус")
        task.status = st
    if "assignee_user_id" in patch:
        uid = patch["assignee_user_id"]
        _require_member(db, task.company_id, uid)
        task.assignee_user_id = uid

    company = db.get(Company, task.company_id)
    company_name = company.name if company else "компанию"
    _sync_calendar_obligation(db, task)

    assignee_changed = (
        "assignee_user_id" in patch and task.assignee_user_id and task.assignee_user_id != prev_assignee
    )
    if assignee_changed:
        _notify_assignee(db, task=task, actor=actor, company_name=company_name, is_new=True)
    db.flush()
    return task


def delete_task(db: Session, task: CompanyTask) -> None:
    if task.obligation_id:
        ob = db.get(FinancialObligation, task.obligation_id)
        if ob is not None:
            db.delete(ob)
    db.delete(task)
    db.flush()


def get_task(db: Session, company_id: str, task_id: str) -> CompanyTask:
    task = db.scalar(
        select(CompanyTask)
        .options(
            selectinload(CompanyTask.assignee),
            selectinload(CompanyTask.creator),
        )
        .where(CompanyTask.id == task_id, CompanyTask.company_id == company_id)
    )
    if task is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    return task
