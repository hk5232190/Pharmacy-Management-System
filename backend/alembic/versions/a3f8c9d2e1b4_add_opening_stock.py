"""Add Opening Stock tables and Source column to stock_batches

Revision ID: a3f8c9d2e1b4
Revises: a2b3c4d5e6f7a8b9c0d1e2f3
Create Date: 2026-09-23

Safe on both fresh DB and existing client DBs.
- stock_batches.Source is nullable: existing rows stay NULL (not opening stock).
- Two new tables: opening_stock_entries, opening_stock_items.
- No existing tables or data are modified.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a3f8c9d2e1b4'
down_revision: Union[str, Sequence[str], None] = '2581b6ba3257'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add Source to stock_batches — NULL-safe, no existing row is touched.
    #    NULL  = batch created via Purchase, Adjustment, or legacy path (not opening stock).
    #    'OPENING_STOCK' = batch created via the Opening Stock module.
    with op.batch_alter_table('stock_batches', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'Source',
                sa.String(length=30),
                nullable=True,
                comment="NULL=non-opening; 'OPENING_STOCK'=created via Opening Stock module"
            )
        )

    # 2. opening_stock_entries — groups a single opening stock session.
    op.create_table(
        'opening_stock_entries',
        sa.Column('EntryId',    sa.Integer(),       primary_key=True, autoincrement=True),
        sa.Column('ReferenceNo',sa.String(50),      nullable=False),
        sa.Column('ImportHash', sa.String(64),      nullable=True),
        sa.Column('Notes',      sa.Text(),           nullable=True),
        sa.Column('EntryDate',  sa.DateTime(),      server_default=sa.func.now()),
        sa.Column('CreatedBy',  sa.Integer(),       nullable=False),
        sa.Column('TotalItems', sa.Integer(),       default=0),
        sa.Column('TotalValue', sa.Numeric(18, 2), default=0),
        sa.Column('ImportFile', sa.String(255),     nullable=True),
        sa.Column('Status',     sa.String(20),      server_default='ACTIVE'),
        sa.Column('VoidedAt',   sa.DateTime(),      nullable=True),
        sa.Column('VoidedBy',   sa.Integer(),       nullable=True),
        sa.ForeignKeyConstraint(['CreatedBy'], ['users.UserId']),
        sa.ForeignKeyConstraint(['VoidedBy'],  ['users.UserId']),
    )
    op.create_index(
        'UQ_os_entries_ReferenceNo',
        'opening_stock_entries', ['ReferenceNo'], unique=True
    )
    op.create_index(
        'UQ_os_entries_ImportHash',
        'opening_stock_entries', ['ImportHash'], unique=True
    )

    # 3. opening_stock_items — one row per batch line within a session.
    op.create_table(
        'opening_stock_items',
        sa.Column('ItemId',            sa.Integer(),       primary_key=True, autoincrement=True),
        sa.Column('EntryId',           sa.Integer(),       nullable=False),
        sa.Column('BatchId',           sa.Integer(),       nullable=False),
        sa.Column('MedicineId',        sa.Integer(),       nullable=False),
        sa.Column('BatchCode',         sa.String(50),      nullable=False),
        sa.Column('Quantity',          sa.Integer(),       nullable=False),
        sa.Column('CostPrice',         sa.Numeric(18, 2), nullable=False),
        sa.Column('SellingPrice',      sa.Numeric(18, 2), nullable=False),
        sa.Column('ExpiryDate',        sa.Date(),          nullable=False),
        sa.Column('ManufacturingDate', sa.Date(),          nullable=True),
        sa.ForeignKeyConstraint(['EntryId'],    ['opening_stock_entries.EntryId']),
        sa.ForeignKeyConstraint(['BatchId'],    ['stock_batches.BatchId']),
        sa.ForeignKeyConstraint(['MedicineId'], ['medicines.MedicineId']),
    )
    op.create_index(
        'IX_opening_stock_items_EntryId',
        'opening_stock_items', ['EntryId']
    )


def downgrade() -> None:
    op.drop_index('IX_opening_stock_items_EntryId', table_name='opening_stock_items')
    op.drop_table('opening_stock_items')
    op.drop_index('UQ_os_entries_ImportHash',  table_name='opening_stock_entries')
    op.drop_index('UQ_os_entries_ReferenceNo', table_name='opening_stock_entries')
    op.drop_table('opening_stock_entries')
    with op.batch_alter_table('stock_batches', schema=None) as batch_op:
        batch_op.drop_column('Source')
