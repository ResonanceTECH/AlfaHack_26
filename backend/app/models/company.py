from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import LegalForm, MemberRole
from app.db.base import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    inn: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    legal_form: Mapped[LegalForm] = mapped_column(
        Enum(LegalForm, name="legal_form", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    ogrn: Mapped[str] = mapped_column(String(15), nullable=False)
    industry: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_date: Mapped[date] = mapped_column(Date, nullable=False)
    region: Mapped[str] = mapped_column(String(255), nullable=False)
    employees_count: Mapped[int] = mapped_column(Integer, default=0)
    registry_status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    memberships = relationship("CompanyMembership", back_populates="company", cascade="all, delete-orphan")
    registry_snapshots = relationship(
        "RegistrySnapshot", back_populates="company", cascade="all, delete-orphan"
    )
    financial_snapshots = relationship(
        "FinancialSnapshot", back_populates="company", cascade="all, delete-orphan"
    )
    statements = relationship("FinancialStatement", back_populates="company", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="company", cascade="all, delete-orphan")
    obligations = relationship("FinancialObligation", back_populates="company", cascade="all, delete-orphan")
    funding_needs = relationship("FundingNeed", back_populates="company", cascade="all, delete-orphan")
    applications = relationship("CreditApplication", back_populates="company", cascade="all, delete-orphan")


class CompanyMembership(Base):
    __tablename__ = "company_memberships"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_company_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, name="member_role", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    permissions: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="memberships")
    user = relationship("User", back_populates="memberships")


CompanyMember = CompanyMembership


class RegistrySnapshot(Base):
    __tablename__ = "registry_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True
    )
    inn: Mapped[str] = mapped_column(String(12), index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="SYNTHETIC_REGISTRY")
    found: Mapped[bool] = mapped_column(default=False)
    registry_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="registry_snapshots")
