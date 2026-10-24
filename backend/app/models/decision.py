from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DecisionType, OfferStatus
from app.db.base import Base

Money = Numeric(18, 2)


class CreditDecision(Base):
    __tablename__ = "credit_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    decision_type: Mapped[DecisionType] = mapped_column(
        Enum(DecisionType, name="decision_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    decided_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason_codes: Mapped[list] = mapped_column(JSONB, default=list)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    factors: Mapped[dict] = mapped_column(JSONB, default=dict)
    model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    policy_version_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("credit_policy_versions.id"), nullable=True
    )
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="decisions")
    offers = relationship("CreditOffer", back_populates="decision")


Decision = CreditDecision


class CreditOffer(Base):
    __tablename__ = "credit_offers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    decision_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("credit_decisions.id"), nullable=True, index=True
    )
    product_id: Mapped[Optional[str]] = mapped_column(ForeignKey("credit_products.id"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    monthly_payment: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    status: Mapped[OfferStatus] = mapped_column(
        Enum(OfferStatus, name="offer_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=OfferStatus.ACTIVE,
    )
    conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="offers")
    decision = relationship("CreditDecision", back_populates="offers")
    acceptance = relationship("OfferAcceptance", back_populates="offer", uselist=False)


Offer = CreditOffer


class OfferAcceptance(Base):
    __tablename__ = "offer_acceptances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    offer_id: Mapped[str] = mapped_column(
        ForeignKey("credit_offers.id", ondelete="CASCADE"), unique=True, index=True
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    accepted_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    offer = relationship("CreditOffer", back_populates="acceptance")
