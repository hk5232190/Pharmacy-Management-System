import sqlite3
import os

DB_PATH = "e:/Projects/PMS-Software/backend/pharma_db.sqlite"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Add columns to sales
        try:
            cursor.execute("ALTER TABLE sales ADD COLUMN ReturnedAmount NUMERIC(18, 2) NOT NULL DEFAULT 0;")
            print("Added ReturnedAmount to sales.")
        except sqlite3.OperationalError as e:
            print(f"Sales ReturnedAmount might exist: {e}")

        try:
            cursor.execute("ALTER TABLE sales ADD COLUMN NetAmount NUMERIC(18, 2) NOT NULL DEFAULT 0;")
            print("Added NetAmount to sales.")
        except sqlite3.OperationalError as e:
            print(f"Sales NetAmount might exist: {e}")

        # Add column to sale_items
        try:
            cursor.execute("ALTER TABLE sale_items ADD COLUMN ReturnedQuantity INTEGER NOT NULL DEFAULT 0;")
            print("Added ReturnedQuantity to sale_items.")
        except sqlite3.OperationalError as e:
            print(f"SaleItems ReturnedQuantity might exist: {e}")

        # Initialize NetAmount = GrandTotal
        cursor.execute("UPDATE sales SET NetAmount = GrandTotal;")
        print("Initialized NetAmount = GrandTotal for all sales.")

        # Process existing sales returns
        cursor.execute("SELECT ReturnId, SalesId, TotalRefundAmount FROM sale_returns;")
        returns = cursor.fetchall()
        
        for ret_id, sale_id, total_refund in returns:
            # Update sale
            cursor.execute("""
                UPDATE sales 
                SET ReturnedAmount = ReturnedAmount + ?,
                    NetAmount = NetAmount - ?
                WHERE SalesId = ?
            """, (total_refund, total_refund, sale_id))
            
            # Update sale items
            cursor.execute("SELECT BatchId, ReturnQuantity FROM sale_return_items WHERE ReturnId = ?", (ret_id,))
            return_items = cursor.fetchall()
            for batch_id, ret_qty in return_items:
                cursor.execute("""
                    UPDATE sale_items
                    SET ReturnedQuantity = ReturnedQuantity + ?
                    WHERE SalesId = ? AND BatchId = ?
                """, (ret_qty, sale_id, batch_id))

        # Also update Status if NetAmount is 0 and it was fully returned
        cursor.execute("UPDATE sales SET Status = 'Returned' WHERE NetAmount <= 0 AND GrandTotal > 0;")
        
        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
