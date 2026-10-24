from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.enums import ApplicationStatus, UserRole
from app.deps import CurrentUser, DbDep
from app.schemas.analyst import AnalystQueueItem, AnalystQueueOut
from app.services.access import require_roles
from app.services.analyst import list_analyst_queue

router = APIRouter(prefix="/analyst", tags=["analyst"])


@router.get("/applications", response_model=AnalystQueueOut)
def analyst_applications_queue(
    db: DbDep,
    user: CurrentUser,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    product_id: str | None = None,
    assigned_to_me: bool = False,
    unassigned: bool = False,
    q: str | None = Query(default=None, description="Поиск по названию/ИНН/продукту/id"),
    include_closed: bool = Query(default=False, description="Включить REJECTED/ISSUED"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AnalystQueueOut:
    require_roles(user, UserRole.ANALYST)
    items, total, counts = list_analyst_queue(
        db,
        user=user,
        status_filter=status_filter,
        product_id=product_id,
        assigned_to_me=assigned_to_me,
        unassigned=unassigned,
        q=q,
        include_closed=include_closed,
        limit=limit,
        offset=offset,
    )
    return AnalystQueueOut(
        items=[AnalystQueueItem(**i) for i in items],
        total=total,
        counts_by_status=counts,
    )
