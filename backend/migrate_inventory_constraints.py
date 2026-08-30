import sys
import os

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, MetaData, text
from database import engine

def migrate():
    print("Starting manual migration to remove CheckConstraint and add new columns...")
    
    with engine.connect() as conn:
        # Add columns to inventory_settings if they don't exist
        try:
            conn.execute(text("ALTER TABLE inventory_settings ADD COLUMN EnableFefo BOOLEAN NOT NULL DEFAULT 1"))
            print("Added EnableFefo to inventory_settings.")
        except Exception as e:
            print(f"Column EnableFefo might already exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE inventory_settings ADD COLUMN DefaultProfitMargin NUMERIC(5, 2) NOT NULL DEFAULT 0.00"))
            print("Added DefaultProfitMargin to inventory_settings.")
        except Exception as e:
            print(f"Column DefaultProfitMargin might already exist: {e}")
            
        conn.commit()
                
    # Alembic batch mode for stock_batches
    print("Migrating stock_batches...")
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        op = Operations(ctx)
        
        try:
            with op.batch_alter_table('stock_batches', schema=None) as batch_op:
                batch_op.drop_constraint('check_quantity_positive', type_='check')
            print("Successfully removed check_quantity_positive constraint from stock_batches.")
        except Exception as e:
            print(f"Failed or already removed constraint check_quantity_positive: {e}")
            
        conn.commit()
        
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
