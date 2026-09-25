"""add DefaultDiscountRate to billing_settings

Revision ID: c1d2e3f4a5b6
Revises: 4e5e634e5725
Create Date: 2026-09-25 00:00:00.000000

Guarded + idempotent migration for DefaultDiscountRate.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "4e5e634e5725"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add DefaultDiscountRate column to billing_settings if not already present."""
    bind = op.get_bind()
    if not bind.dialect.has_table(bind, "billing_settings"):
        return
    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("billing_settings")]
    if "DefaultDiscountRate" not in columns:
        with op.batch_alter_table("billing_settings") as batch_op:
            batch_op.add_column(
                sa.Column("DefaultDiscountRate", sa.Numeric(precision=5, scale=2), nullable=False, server_default=sa.text("0.00"))
            )


def downgrade() -> None:
    """Drop DefaultDiscountRate column from billing_settings."""
    with op.batch_alter_table("billing_settings") as batch_op:
        batch_op.drop_column("DefaultDiscountRate")
