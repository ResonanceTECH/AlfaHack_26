from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ApplicationStatus, GoalType, ProductType, WorkflowStatus
from app.db.base import Base

Money = Numeric(18, 2)


class CreditApplication(Base):
    __tablename__ = "credit_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    assigned_analyst_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    assigned_manager_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    product_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("credit_products.id"), nullable=True, index=True
    )
    product_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    funding_need_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("funding_needs.id"), nullable=True, index=True
    )
    product_type: Mapped[Optional[ProductType]] = mapped_column(
        Enum(
            ProductType,
            name="product_type",
            create_constraint=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    goal_type: Mapped[Optional[GoalType]] = mapped_column(
        Enum(
            GoalType,
            name="goal_type",
            create_constraint=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ApplicationStatus.DRAFT,
        index=True,
    )
    current_step: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    form_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    readiness_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status_history: Mapped[list] = mapped_column(JSONB, default=list)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="applications")
    assigned_manager = relationship("User", foreign_keys=[assigned_manager_id])
    assigned_analyst = relationship("User", foreign_keys=[assigned_analyst_id])
    documents = relationship("ApplicationDocument", back_populates="application", cascade="all, delete-orphan")
    document_requests = relationship(
        "DocumentRequest", back_populates="application", cascade="all, delete-orphan"
    )
    status_events = relationship(
        "ApplicationStatusHistory", back_populates="application", cascade="all, delete-orphan"
    )
    comments = relationship("ApplicationComment", back_populates="application", cascade="all, delete-orphan")
    workflows = relationship("ApplicationWorkflow", back_populates="application", cascade="all, delete-orphan")
    checks = relationship("ApplicationCheck", back_populates="application", cascade="all, delete-orphan")
    decisions = relationship("CreditDecision", back_populates="application", cascade="all, delete-orphan")
    offers = relationship("CreditOffer", back_populates="application", cascade="all, delete-orphan")
    agreements = relationship("Agreement", back_populates="application", cascade="all, delete-orphan")

    @property
    def requested_amount(self) -> Decimal:
        return self.amount

    @requested_amount.setter
    def requested_amount(self, value: Decimal) -> None:
        self.amount = value

    @property
    def requested_term_months(self) -> int:
        return self.term_months

    @requested_term_months.setter
    def requested_term_months(self, value: int) -> None:
        self.term_months = value


class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False, default="OTHER")
    document_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    uploaded_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="documents")


class DocumentRequest(Base):
    __tablename__ = "document_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    requested_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="OPEN")
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    satisfied_document_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("application_documents.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="document_requests")


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[Optional[ApplicationStatus]] = mapped_column(
        Enum(
            ApplicationStatus,
            name="application_status",
            create_constraint=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    to_status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            name="application_status",
            create_constraint=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    changed_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="status_events")


class ApplicationComment(Base):
    __tablename__ = "application_comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    author_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    author_role: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_internal: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="comments")


class ApplicationWorkflow(Base):
    __tablename__ = "application_workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    workflow_type: Mapped[str] = mapped_column(String(64), nullable=False, default="CREDIT_REVIEW")
    status: Mapped[WorkflowStatus] = mapped_column(
        Enum(WorkflowStatus, name="workflow_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=WorkflowStatus.PENDING,
    )
    current_step: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    context: Mapped[dict] = mapped_column(JSONB, default=dict)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="workflows")


class ApplicationCheck(Base):
    __tablename__ = "application_checks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    workflow_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("application_workflows.id", ondelete="SET NULL"), nullable=True, index=True
    )
    check_key: Mapped[str] = mapped_column(String(64), nullable=False)
    audience: Mapped[str] = mapped_column(String(32), default="INTERNAL")
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason_codes: Mapped[list] = mapped_column(JSONB, default=list)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="checks")
