from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ProductStatus, ProductType
from app.db.base import Base

Money = Numeric(18, 2)


class CreditProduct(Base):
    __tablename__ = "credit_products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    code: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[ProductType] = mapped_column(
        Enum(ProductType, name="product_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    amount_min: Mapped[Decimal] = mapped_column(Money, nullable=False)
    amount_max: Mapped[Decimal] = mapped_column(Money, nullable=False)
    term_min: Mapped[int] = mapped_column(Integer, nullable=False)
    term_max: Mapped[int] = mapped_column(Integer, nullable=False)
    rate_min: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    rate_max: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    collateral_required: Mapped[bool] = mapped_column(Boolean, default=False)
    legal_forms: Mapped[list] = mapped_column(JSONB, default=list)
    min_business_age_months: Mapped[int] = mapped_column(Integer, default=0)
    suitable_goals: Mapped[list] = mapped_column(JSONB, default=list)
    documents: Mapped[list] = mapped_column(JSONB, default=list)
    fees: Mapped[list] = mapped_column(JSONB, default=list)
    schedule_types: Mapped[list] = mapped_column(JSONB, default=list)
    eligibility_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    features: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ProductStatus.PUBLISHED,
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    versions = relationship("CreditProductVersion", back_populates="product", cascade="all, delete-orphan")
    rules = relationship("CreditProductRule", back_populates="product", cascade="all, delete-orphan")


class CreditProductVersion(Base):
    __tablename__ = "credit_product_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    product_id: Mapped[str] = mapped_column(ForeignKey("credit_products.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)
    changelog: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product = relationship("CreditProduct", back_populates="versions")


class CreditProductRule(Base):
    __tablename__ = "credit_product_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    product_id: Mapped[str] = mapped_column(ForeignKey("credit_products.id", ondelete="CASCADE"), index=True)
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False)
    parameters: Mapped[dict] = mapped_column(JSONB, default=dict)
    version: Mapped[str] = mapped_column(String(32), default="demo-rules-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product = relationship("CreditProduct", back_populates="rules")


class CreditRecommendation(Base):
    __tablename__ = "credit_recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("credit_products.id"), index=True)
    funding_need_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("funding_needs.id"), nullable=True, index=True
    )
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    reasons: Mapped[list] = mapped_column(JSONB, default=list)
    warnings: Mapped[list] = mapped_column(JSONB, default=list)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    model_version: Mapped[str] = mapped_column(String(64), default="demo-rules-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def business_goal_id(self) -> Optional[str]:
        return self.funding_need_id

    @business_goal_id.setter
    def business_goal_id(self, value: Optional[str]) -> None:
        self.funding_need_id = value
