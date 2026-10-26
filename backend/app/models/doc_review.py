"""Internal team document review assignments (accountant checks uploads / bank decision)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DocumentReview(Base):
    __tablename__ = "document_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    application_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Live ApplicationDocument.id when known
    document_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    company_document_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    # app_slot | app_document | company_document | decision_report | pack
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="app_slot")
    slot_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    assignee_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    assigned_by: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # review | approve
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, default="review")
    # pending | viewed | approved | rejected
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    task_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("company_tasks.id", ondelete="SET NULL"), nullable=True
    )
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    assignee = relationship("User", foreign_keys=[assignee_user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])
