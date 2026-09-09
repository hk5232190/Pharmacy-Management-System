"""Add Role to users table

Revision ID: a1b2c3d4e5f6a7b8
Revises: 7a4b58fbb42b
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '7a4b58fbb42b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Role column, defaulting existing users to 'admin'."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('Role', sa.String(20), nullable=False, server_default='admin'))


def downgrade() -> None:
    """Remove Role column."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('Role')