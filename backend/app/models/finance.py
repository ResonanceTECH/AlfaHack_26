from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import StatementStatus, TransactionCategory
from app.db.base import Base

Money = Numeric(18, 2)


class FinancialSnapshot(Base):
    __tablename__ = "financial_snapshots"
    __table_args__ = (UniqueConstraint("company_id", "period", name="uq_company_period"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    period: Mapped[str] = mapped_column(String(7), nullable=False)
    avg_monthly_revenue: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    operating_expenses: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    net_profit: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    assets: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    liabilities: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    equity: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    cash_balance: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    active_credits: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    debt_load: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    source: Mapped[str] = mapped_column(String(64), default="manual")
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="financial_snapshots")

    @property
    def revenue(self) -> Decimal:
        return self.avg_monthly_revenue

    @property
    def expenses(self) -> Decimal:
        return self.operating_expenses


class FinancialStatement(Base):
    __tablename__ = "financial_statements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    period_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), default="UPLOAD")
    file_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    status: Mapped[StatementStatus] = mapped_column(
        Enum(StatementStatus, name="statement_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=StatementStatus.QUEUED,
    )
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    parsed_summary: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    company = relationship("Company", back_populates="statements")
    transactions = relationship("Transaction", back_populates="statement")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    statement_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("financial_statements.id", ondelete="SET NULL"), nullable=True, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    category: Mapped[Optional[TransactionCategory]] = mapped_column(
        Enum(
            TransactionCategory,
            name="transaction_category",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    counterparty: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    balance_after: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    external_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="transactions")
    statement = relationship("FinancialStatement", back_populates="transactions")


FinancialTransaction = Transaction


class FinancialObligation(Base):
    __tablename__ = "financial_obligations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    creditor: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    remaining: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="obligations")


class CashflowForecast(Base):
    __tablename__ = "cashflow_forecasts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    horizon_months: Mapped[int] = mapped_column(Integer, default=6)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    points: Mapped[list] = mapped_column(JSONB, default=list)
    assumptions: Mapped[dict] = mapped_column(JSONB, default=dict)
    disclaimer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CreditScenario(Base):
    __tablename__ = "credit_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parameters: Mapped[dict] = mapped_column(JSONB, default=dict)
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages = relationship("AiMessage", back_populates="conversation", cascade="all, delete-orphan")


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("AiConversation", back_populates="messages")
