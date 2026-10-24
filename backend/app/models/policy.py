from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import PolicyStatus
from app.db.base import Base


class CreditPolicy(Base):
    __tablename__ = "credit_policies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[PolicyStatus] = mapped_column(
        Enum(PolicyStatus, name="policy_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=PolicyStatus.DRAFT,
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    versions = relationship("CreditPolicyVersion", back_populates="policy", cascade="all, delete-orphan")
    simulations = relationship("PolicySimulation", back_populates="policy", cascade="all, delete-orphan")


Policy = CreditPolicy


class CreditPolicyVersion(Base):
    __tablename__ = "credit_policy_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    policy_id: Mapped[str] = mapped_column(ForeignKey("credit_policies.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    changelog: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    policy = relationship("CreditPolicy", back_populates="versions")


PolicyVersion = CreditPolicyVersion


class PolicySimulation(Base):
    __tablename__ = "policy_simulations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    policy_id: Mapped[str] = mapped_column(ForeignKey("credit_policies.id", ondelete="CASCADE"), index=True)
    policy_version_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("credit_policy_versions.id"), nullable=True
    )
    input_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    policy = relationship("CreditPolicy", back_populates="simulations")
