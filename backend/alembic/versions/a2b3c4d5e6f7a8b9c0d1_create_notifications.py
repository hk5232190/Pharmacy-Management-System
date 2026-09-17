"""create notifications table (idempotent)

Revision ID: a2b3c4d5e6f7a8b9c0d1
Revises: a1b2c3d4e5f6a7b8
Create Date: 2025-09-16 00:00:00.000000

Guarded so it is a no-op on databases that already provisioned the table
via the historical inline main.py DDL (clean baseline and existing installs).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the notifications table if it does not already exist."""
    bind = op.get_bind()
    if bind.dialect.has_table(bind, "notifications"):
        return
    op.create_table(
        "notifications",
        sa.Column("NotificationId", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("Type", sa.String(length=50), nullable=False, index=True),
        sa.Column("Title", sa.String(length=200), nullable=False),
        sa.Column("Message", sa.Text(), nullable=False),
        sa.Column("Priority", sa.String(length=20), nullable=False, server_default=sa.text("'Normal'")),
        sa.Column("RelatedModule", sa.String(length=50), nullable=True),
        sa.Column("RelatedRecordId", sa.Integer(), nullable=True),
        sa.Column("EntityKey", sa.String(length=150), nullable=True, index=True),
        sa.Column("ActionUrl", sa.String(length=255), nullable=True),
        sa.Column("IsRead", sa.Boolean(), nullable=False, index=True),
        sa.Column("CreatedAt", sa.DateTime(), nullable=False, index=True),
    )


def downgrade() -> None:
    """Remove the notifications table if present."""
    bind = op.get_bind()
    if not bind.dialect.has_table(bind, "notifications"):
        return
    op.drop_table("notifications")
