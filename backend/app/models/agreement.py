from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

Money = Numeric(18, 2)


class Agreement(Base):
    __tablename__ = "agreements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True
    )
    offer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("credit_offers.id"), nullable=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    number: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    document_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    application = relationship("CreditApplication", back_populates="agreements")
    confirmation = relationship("AgreementConfirmation", back_populates="agreement", uselist=False)


class AgreementConfirmation(Base):
    __tablename__ = "agreement_confirmations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    agreement_id: Mapped[str] = mapped_column(
        ForeignKey("agreements.id", ondelete="CASCADE"), unique=True, index=True
    )
    confirmed_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    agreement = relationship("Agreement", back_populates="confirmation")
