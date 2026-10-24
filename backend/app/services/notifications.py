from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_notification(n: Notification) -> dict[str, Any]:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "channel": n.channel or "IN_APP",
        "is_read": bool(n.is_read),
        "read_at": n.read_at,
        "created_at": n.created_at,
        "payload": n.payload or {},
    }


def notify(
    db: Session,
    *,
    user_id: str,
    type: str,
    title: str,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
    channel: str = "IN_APP",
) -> Notification:
    n = Notification(
        user_id=user_id,
        channel=channel,
        type=type,
        title=title,
        body=body,
        payload=payload or {},
        is_read=False,
    )
    db.add(n)
    db.flush()
    return n


def notify_user(
    db: Session,
    user: User | None,
    *,
    type: str,
    title: str,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification | None:
    if user is None:
        return None
    return notify(db, user_id=user.id, type=type, title=title, body=body, payload=payload)


def list_notifications(
    db: Session,
    *,
    user_id: str,
    unread_only: bool = False,
    type_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Notification], int, int]:
    base = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        base = base.where(Notification.is_read.is_(False))
    if type_filter:
        base = base.where(Notification.type == type_filter)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    unread = db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
    ) or 0

    rows = list(
        db.scalars(
            base.order_by(Notification.created_at.desc()).offset(offset).limit(min(limit, 100))
        ).all()
    )
    return rows, int(total), int(unread)


def get_own_notification(db: Session, user_id: str, notification_id: str) -> Notification | None:
    return db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )


def mark_read(db: Session, notification: Notification, *, is_read: bool = True) -> Notification:
    if is_read:
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = utcnow()
    else:
        notification.is_read = False
        notification.read_at = None
    db.flush()
    return notification


def mark_all_read(db: Session, user_id: str) -> int:
    now = utcnow()
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=now)
    )
    return int(result.rowcount or 0)
