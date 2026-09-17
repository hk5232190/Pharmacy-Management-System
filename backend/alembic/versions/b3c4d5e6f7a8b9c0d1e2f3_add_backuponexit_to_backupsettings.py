"""add BackupOnExit column to backup_settings (idempotent, guarded)

Revision ID: b3c4d5e6f7a8b9c0d1e2f3
Revises: a2b3c4d5e6f7a8b9c0d1
Create Date: 2025-09-16 00:00:00.000000

Guarded + idempotent so it is safe on every possible database state:
  * Clean baseline copy   - column already present  -> no-op
  * Existing (live) DB    - column already present  -> no-op
  * Legacy/older DB       - column absent           -> adds it (matches the
                                                       historical inline DDL
                                                       from main.py)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add BackupOnExit column if it does not already exist (safe on any DB)."""
    bind = op.get_bind()
    if not bind.dialect.has_table(bind, "backup_settings"):
        return
    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("backup_settings")]
    if "BackupOnExit" in columns:
        return
    with op.batch_alter_table("backup_settings") as batch_op:
        batch_op.add_column(
            sa.Column("BackupOnExit", sa.Boolean(), nullable=True, server_default=sa.text("1"))
        )


def downgrade() -> None:
    """Remove BackupOnExit column if present."""
    bind = op.get_bind()
    if not bind.dialect.has_table(bind, "backup_settings"):
        return
    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("backup_settings")]
    if "BackupOnExit" not in columns:
        return
    with op.batch_alter_table("backup_settings") as batch_op:
        batch_op.drop_column("BackupOnExit")
