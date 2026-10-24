from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import CorrelationId, CurrentUser, DbDep
from app.schemas.notification import (
    NotificationListOut,
    NotificationOut,
    NotificationPatch,
    ReadAllOut,
)
from app.services.audit import write_audit
from app.services.notifications import (
    get_own_notification,
    list_notifications,
    mark_all_read,
    mark_read,
    serialize_notification,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListOut)
def get_notifications(
    db: DbDep,
    user: CurrentUser,
    unread: bool | None = Query(default=None, description="true — только непрочитанные"),
    type: str | None = Query(default=None, alias="type"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> NotificationListOut:
    rows, total, unread_count = list_notifications(
        db,
        user_id=user.id,
        unread_only=bool(unread),
        type_filter=type,
        limit=limit,
        offset=offset,
    )
    return NotificationListOut(
        items=[NotificationOut(**serialize_notification(n)) for n in rows],
        unread_count=unread_count,
        total=total,
    )


@router.patch("/{notification_id}", response_model=NotificationOut)
def patch_notification(
    notification_id: str,
    body: NotificationPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> NotificationOut:
    n = get_own_notification(db, user.id, notification_id)
    if n is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Уведомление не найдено")
    mark_read(db, n, is_read=body.is_read)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="notification",
        entity_id=n.id,
        action="mark_read" if body.is_read else "mark_unread",
        correlation_id=cid,
    )
    db.commit()
    db.refresh(n)
    return NotificationOut(**serialize_notification(n))


@router.post("/read-all", response_model=ReadAllOut)
def read_all_notifications(db: DbDep, user: CurrentUser, cid: CorrelationId) -> ReadAllOut:
    updated = mark_all_read(db, user.id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="notification",
        entity_id=user.id,
        action="read_all",
        details={"updated": updated},
        correlation_id=cid,
    )
    db.commit()
    return ReadAllOut(updated=updated)
