from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ChallengeChannel, ChallengePurpose
from app.db.base import Base


class VerificationChallenge(Base):
    __tablename__ = "verification_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    registration_session_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    purpose: Mapped[ChallengePurpose] = mapped_column(
        Enum(ChallengePurpose, name="challenge_purpose", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    channel: Mapped[ChallengeChannel] = mapped_column(
        Enum(ChallengeChannel, name="challenge_channel", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    destination: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="verification_challenges")
