import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "pharma_db.sqlite")

def migrate():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if system_preferences table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='system_preferences'")
        if not cursor.fetchone():
            print("Table system_preferences does not exist. Migration skipped.")
            return

        # Get existing columns
        cursor.execute("PRAGMA table_info(system_preferences)")
        columns = [col[1] for col in cursor.fetchall()]

        # Define required columns
        new_columns = {
            "AlertVolume": "INTEGER NOT NULL DEFAULT 50",
            "AlertTriggerSale": "BOOLEAN NOT NULL DEFAULT 1",
            "AlertTriggerLowStock": "BOOLEAN NOT NULL DEFAULT 1",
            "AlertTriggerNearExpiry": "BOOLEAN NOT NULL DEFAULT 1",
            "AlertTriggerErrors": "BOOLEAN NOT NULL DEFAULT 1"
        }

        # Add missing columns
        for col_name, col_def in new_columns.items():
            if col_name not in columns:
                print(f"Adding column {col_name}...")
                cursor.execute(f"ALTER TABLE system_preferences ADD COLUMN {col_name} {col_def}")
                print(f"Successfully added {col_name}.")
            else:
                print(f"Column {col_name} already exists.")

        conn.commit()
        print("Migration of system_preferences complete.")

    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
