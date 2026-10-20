from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ApplicationStatus
from app.db.base import Base

Money = Numeric(18, 2)


class CreditApplication(Base):
    __tablename__ = "credit_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("credit_products.id"), index=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status", values_callable=lambda x: [e.value for e in x]),
        default=ApplicationStatus.DRAFT,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, default="")
    assigned_manager_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    readiness_score: Mapped[int] = mapped_column(Integer, default=0)
    status_history: Mapped[list] = mapped_column(JSONB, default=list)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="applications")
    documents = relationship(
        "ApplicationDocument", back_populates="application", cascade="all, delete-orphan"
    )
    comments = relationship(
        "ApplicationComment", back_populates="application", cascade="all, delete-orphan"
    )
    assigned_manager = relationship("User", foreign_keys=[assigned_manager_id])


class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    document_type: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    size: Mapped[int] = mapped_column(Integer, default=0)
    storage_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="documents")


class ApplicationComment(Base):
    __tablename__ = "application_comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[str] = mapped_column(String(32), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="comments")
