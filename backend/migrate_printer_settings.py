import sys
import os
import sqlite3

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from database import engine

def column_exists(conn, table_name, column_name):
    query = f"PRAGMA table_info({table_name})"
    result = conn.execute(text(query)).fetchall()
    return any(row[1] == column_name for row in result)

def migrate():
    print("Starting deterministic migration for printer_settings...")
    
    with engine.connect() as conn:
        columns_to_add = [
            ("AutoCutPaper", "BOOLEAN NOT NULL DEFAULT 1"),
            ("OpenCashDrawer", "BOOLEAN NOT NULL DEFAULT 1"),
            ("PrintBatchAndExpiry", "BOOLEAN NOT NULL DEFAULT 1"),
            ("PrintLicenseAndNtn", "BOOLEAN NOT NULL DEFAULT 0"),
            ("PrintDoctorAndPatient", "BOOLEAN NOT NULL DEFAULT 0")
        ]
        
        for col_name, col_def in columns_to_add:
            if not column_exists(conn, "printer_settings", col_name):
                try:
                    conn.execute(text(f"ALTER TABLE printer_settings ADD COLUMN {col_name} {col_def}"))
                    print(f"Added column {col_name} successfully.")
                except Exception as e:
                    print(f"Failed to add column {col_name}: {e}")
            else:
                print(f"Column {col_name} already exists. Skipping.")
                
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
