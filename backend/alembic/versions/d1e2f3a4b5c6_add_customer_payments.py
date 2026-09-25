"""add customer_payments table

Revision ID: d1e2f3a4b5c6
Revises: be237f406e8a
Create Date: 2026-09-25 09:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'be237f406e8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'customer_payments',
        sa.Column('PaymentId', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('PaymentReceiptNumber', sa.String(length=50), nullable=False),
        sa.Column('CustomerId', sa.Integer(), nullable=False),
        sa.Column('UserId', sa.Integer(), nullable=False),
        sa.Column('SalesId', sa.Integer(), nullable=True),
        sa.Column('Amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('PaymentMethod', sa.String(length=50), nullable=False, server_default='Cash'),
        sa.Column('PaymentDate', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('Notes', sa.Text(), nullable=True),
        sa.Column('InvoicesCovered', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['CustomerId'], ['customers.CustomerId'], ),
        sa.ForeignKeyConstraint(['UserId'], ['users.UserId'], ),
        sa.ForeignKeyConstraint(['SalesId'], ['sales.SalesId'], ),
        sa.PrimaryKeyConstraint('PaymentId')
    )
    with op.batch_alter_table('customer_payments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_customer_payments_PaymentReceiptNumber'), ['PaymentReceiptNumber'], unique=True)
        batch_op.create_index(batch_op.f('ix_customer_payments_CustomerId'), ['CustomerId'], unique=False)
        batch_op.create_index(batch_op.f('ix_customer_payments_PaymentDate'), ['PaymentDate'], unique=False)

def downgrade() -> None:
    with op.batch_alter_table('customer_payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_customer_payments_PaymentDate'))
        batch_op.drop_index(batch_op.f('ix_customer_payments_CustomerId'))
        batch_op.drop_index(batch_op.f('ix_customer_payments_PaymentReceiptNumber'))
    op.drop_table('customer_payments')
