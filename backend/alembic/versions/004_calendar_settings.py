"""Company calendar reminder settings JSONB.

Revision ID: 004
Revises: 003
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        text(
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS "
            "calendar_settings JSONB NOT NULL DEFAULT '{}'::jsonb"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("ALTER TABLE companies DROP COLUMN IF EXISTS calendar_settings"))
