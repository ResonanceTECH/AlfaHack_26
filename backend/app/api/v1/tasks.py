from __future__ import annotations

from fastapi import APIRouter, status

from app.deps import CorrelationId, CurrentUser, DbDep
from app.schemas.common import MessageOut
from app.schemas.task import CompanyTaskCreate, CompanyTaskOut, CompanyTaskUpdate
from app.services.access import require_company_access
from app.services.audit import write_audit
from app.services.company_tasks import (
    create_task,
    delete_task,
    get_task,
    list_tasks,
    serialize_task,
    update_task,
)

router = APIRouter(tags=["tasks"])


@router.get("/companies/{company_id}/tasks", response_model=list[CompanyTaskOut])
def company_list_tasks(
    company_id: str, db: DbDep, user: CurrentUser
) -> list[CompanyTaskOut]:
    require_company_access(db, user, company_id)
    return [CompanyTaskOut(**t) for t in list_tasks(db, company_id)]


@router.post(
    "/companies/{company_id}/tasks",
    response_model=CompanyTaskOut,
    status_code=status.HTTP_201_CREATED,
)
def company_create_task(
    company_id: str,
    body: CompanyTaskCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> CompanyTaskOut:
    require_company_access(db, user, company_id, write=True)
    task = create_task(
        db,
        company_id=company_id,
        actor=user,
        title=body.title,
        description=body.description,
        assignee_user_id=body.assignee_user_id,
        due_date=body.due_date,
        status=body.status,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_task",
        entity_id=task.id,
        action="task_create",
        details={
            "title": task.title,
            "assignee_user_id": task.assignee_user_id,
            "due_date": task.due_date.isoformat() if task.due_date else None,
        },
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    task = get_task(db, company_id, task.id)
    return CompanyTaskOut(**serialize_task(task))


@router.patch(
    "/companies/{company_id}/tasks/{task_id}",
    response_model=CompanyTaskOut,
)
def company_patch_task(
    company_id: str,
    task_id: str,
    body: CompanyTaskUpdate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> CompanyTaskOut:
    require_company_access(db, user, company_id, write=True)
    task = get_task(db, company_id, task_id)
    update_task(db, task=task, actor=user, patch=body.model_dump(exclude_unset=True))
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_task",
        entity_id=task.id,
        action="task_update",
        details=body.model_dump(exclude_unset=True, mode="json"),
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    task = get_task(db, company_id, task_id)
    return CompanyTaskOut(**serialize_task(task))


@router.delete(
    "/companies/{company_id}/tasks/{task_id}",
    response_model=MessageOut,
)
def company_delete_task(
    company_id: str,
    task_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> MessageOut:
    require_company_access(db, user, company_id, write=True)
    task = get_task(db, company_id, task_id)
    delete_task(db, task)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_task",
        entity_id=task_id,
        action="task_delete",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return MessageOut(message="ok")
