from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import GoalType
from app.db.base import Base

Money = Numeric(18, 2)


class FundingNeed(Base):
    __tablename__ = "funding_needs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    goal_type: Mapped[GoalType] = mapped_column(
        Enum(GoalType, name="goal_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    costs: Mapped[dict] = mapped_column(JSONB, default=dict)
    reserve: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    own_funds: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    other_funding: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    required_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    urgency: Mapped[str] = mapped_column(String(32), default="MEDIUM")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="funding_needs")
    items = relationship("FundingNeedItem", back_populates="need", cascade="all, delete-orphan")

    @property
    def purpose(self) -> GoalType:
        return self.goal_type

    @purpose.setter
    def purpose(self, value: GoalType) -> None:
        self.goal_type = value

    @property
    def amount(self) -> Decimal:
        return self.required_amount

    @amount.setter
    def amount(self, value: Decimal) -> None:
        self.required_amount = value


BusinessGoal = FundingNeed


class FundingNeedItem(Base):
    __tablename__ = "funding_need_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    need_id: Mapped[str] = mapped_column(ForeignKey("funding_needs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    need = relationship("FundingNeed", back_populates="items")
