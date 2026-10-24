"""Wipe и новая схема P0 по 4 пункту спеки.

Revision ID: 002
Revises: 001
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.db.base import Base
import app.models  # noqa: F401

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    # Wipe всех таблиц/enum, alembic_version оставляем — иначе stamp сломается
    bind.execute(
        text(
            """
            DO $$ DECLARE
              r RECORD;
            BEGIN
              FOR r IN (
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tablename <> 'alembic_version'
              ) LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
              END LOOP;
              FOR r IN (
                SELECT t.typname FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typtype = 'e'
              ) LOOP
                EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
              END LOOP;
            END $$;
            """
        )
    )
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
