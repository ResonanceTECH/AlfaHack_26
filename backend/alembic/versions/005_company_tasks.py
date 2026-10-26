"""Company collaborative tasks.

Revision ID: 005
Revises: 004
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.db.base import Base
import app.models  # noqa: F401

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    bind.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS company_tasks (
                id VARCHAR(36) PRIMARY KEY,
                company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                title VARCHAR(512) NOT NULL,
                description TEXT,
                status VARCHAR(32) NOT NULL DEFAULT 'todo',
                assignee_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                due_date DATE,
                obligation_id VARCHAR(36) REFERENCES financial_obligations(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
            """
        )
    )
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_company_tasks_company_id ON company_tasks (company_id)"
        )
    )
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_company_tasks_assignee_user_id "
            "ON company_tasks (assignee_user_id)"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("DROP TABLE IF EXISTS company_tasks"))
