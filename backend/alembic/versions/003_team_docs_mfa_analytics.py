"""Team invites, company documents, MFA column.

Revision ID: 003
Revises: 002
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.db.base import Base
import app.models  # noqa: F401

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "mfa_enabled BOOLEAN NOT NULL DEFAULT false"
        )
    )
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("DROP TABLE IF EXISTS company_documents"))
    bind.execute(text("DROP TABLE IF EXISTS company_invites"))
    bind.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled"))
