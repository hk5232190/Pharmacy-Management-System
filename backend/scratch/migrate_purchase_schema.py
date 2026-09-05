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
        # Add columns to purchases
        try:
            cursor.execute("ALTER TABLE purchases ADD COLUMN ReturnedAmount NUMERIC(18, 2) NOT NULL DEFAULT 0;")
            print("Added ReturnedAmount to purchases.")
        except sqlite3.OperationalError as e:
            print(f"Purchases ReturnedAmount might exist: {e}")

        try:
            cursor.execute("ALTER TABLE purchases ADD COLUMN NetAmount NUMERIC(18, 2) NOT NULL DEFAULT 0;")
            print("Added NetAmount to purchases.")
        except sqlite3.OperationalError as e:
            print(f"Purchases NetAmount might exist: {e}")

        # Add column to purchase_items
        try:
            cursor.execute("ALTER TABLE purchase_items ADD COLUMN ReturnedQuantity INTEGER NOT NULL DEFAULT 0;")
            print("Added ReturnedQuantity to purchase_items.")
        except sqlite3.OperationalError as e:
            print(f"PurchaseItems ReturnedQuantity might exist: {e}")

        # Initialize NetAmount = GrandTotal
        cursor.execute("UPDATE purchases SET NetAmount = GrandTotal;")
        print("Initialized NetAmount = GrandTotal for all purchases.")

        # Process existing purchase returns
        cursor.execute("SELECT ReturnId, PurchaseId, TotalRefundAmount FROM purchase_returns;")
        returns = cursor.fetchall()
        
        for ret_id, pur_id, total_refund in returns:
            # Update purchase
            cursor.execute("""
                UPDATE purchases 
                SET ReturnedAmount = ReturnedAmount + ?,
                    NetAmount = NetAmount - ?
                WHERE PurchaseId = ?
            """, (total_refund, total_refund, pur_id))
            
            # Update purchase items
            cursor.execute("SELECT MedicineId, BatchCode, ReturnQuantity FROM purchase_return_items WHERE ReturnId = ?", (ret_id,))
            return_items = cursor.fetchall()
            for med_id, batch_code, ret_qty in return_items:
                cursor.execute("""
                    UPDATE purchase_items
                    SET ReturnedQuantity = ReturnedQuantity + ?
                    WHERE PurchaseId = ? AND MedicineId = ? AND BatchCode = ?
                """, (ret_qty, pur_id, med_id, batch_code))

        # Also update PaymentStatus if NetAmount is 0 and it was fully returned
        cursor.execute("UPDATE purchases SET PaymentStatus = 'Returned' WHERE NetAmount <= 0 AND GrandTotal > 0;")
        
        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
