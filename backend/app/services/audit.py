from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent

def write_audit(
    db: Session,
    *,
    actor_id: str | None,
    entity_type: str,
    entity_id: str,
    action: str,
    details: dict[str, Any] | None = None,
    correlation_id: str | None = None,
    ip_address: str | None = None,
    company_id: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details,
        correlation_id=correlation_id,
        ip_address=ip_address,
        company_id=company_id,
    )
    db.add(event)
    return event
