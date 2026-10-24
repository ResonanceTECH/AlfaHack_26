from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MlModelRegistry(Base):
    __tablename__ = "ml_model_registry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    task: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="REGISTERED")
    endpoint: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    evaluations = relationship("ModelEvaluation", back_populates="model", cascade="all, delete-orphan")
    activations = relationship("ModelActivation", back_populates="model", cascade="all, delete-orphan")


class ModelEvaluation(Base):
    __tablename__ = "model_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    model_id: Mapped[str] = mapped_column(ForeignKey("ml_model_registry.id", ondelete="CASCADE"), index=True)
    dataset: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    model = relationship("MlModelRegistry", back_populates="evaluations")


class ModelActivation(Base):
    __tablename__ = "model_activations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    model_id: Mapped[str] = mapped_column(ForeignKey("ml_model_registry.id", ondelete="CASCADE"), index=True)
    task: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    activated_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deactivated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    model = relationship("MlModelRegistry", back_populates="activations")
