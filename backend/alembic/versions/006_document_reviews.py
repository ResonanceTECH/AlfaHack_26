"""Document review assignments for team (accountant checks).

Revision ID: 006
Revises: 005
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.db.base import Base
import app.models  # noqa: F401

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    bind.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS document_reviews (
                id VARCHAR(36) PRIMARY KEY,
                company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                application_id VARCHAR(36) REFERENCES credit_applications(id) ON DELETE CASCADE,
                document_id VARCHAR(36),
                company_document_id VARCHAR(36),
                kind VARCHAR(32) NOT NULL DEFAULT 'app_slot',
                slot_key VARCHAR(64),
                title VARCHAR(512) NOT NULL,
                file_name VARCHAR(512),
                assignee_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                assigned_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                purpose VARCHAR(32) NOT NULL DEFAULT 'review',
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                task_id VARCHAR(36) REFERENCES company_tasks(id) ON DELETE SET NULL,
                comment TEXT,
                meta JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
            """
        )
    )
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_document_reviews_company_id ON document_reviews (company_id)"
        )
    )
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_document_reviews_assignee ON document_reviews (assignee_user_id)"
        )
    )
    bind.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_document_reviews_status ON document_reviews (status)"
        )
    )


def downgrade() -> None:
    op.execute(text("DROP TABLE IF EXISTS document_reviews"))
