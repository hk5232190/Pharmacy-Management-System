"""
Migration: Add receipt customization columns to printer_settings table.
Run once: python migrate_receipt_settings.py
Safe to re-run - skips columns that already exist.
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import engine


def column_exists(conn, table_name, column_name):
    result = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return any(row[1] == column_name for row in result)


def add_column_if_missing(conn, table, col_name, col_def):
    if not column_exists(conn, table, col_name):
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
            print(f"  [+] Added column: {col_name}")
        except Exception as e:
            print(f"  [!] Failed to add {col_name}: {e}")
    else:
        print(f"  [=] Already exists: {col_name}")


def migrate():
    print("Starting migration: printer_settings receipt customization columns...")

    new_columns = [
        ("Copies",             "INTEGER NOT NULL DEFAULT 1"),
        ("OpenPrintDialog",    "BOOLEAN NOT NULL DEFAULT 0"),
        ("ReceiptTitle",       "VARCHAR(100) DEFAULT 'SALE RECEIPT'"),
        ("FontScale",          "INTEGER NOT NULL DEFAULT 100"),
        ("CharactersPerLine",  "INTEGER NOT NULL DEFAULT 42"),
        ("ItemNameWidth",      "INTEGER NOT NULL DEFAULT 16"),
        ("CustomPaperWidthMm", "INTEGER DEFAULT NULL"),
        ("ShowPhoneNumber",    "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowInvoiceNumber",  "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowDate",           "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowTime",           "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowCashier",        "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowCustomerName",   "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowSubtotal",       "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowDiscount",       "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowTax",            "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowAmountPaid",     "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowChangeDue",      "BOOLEAN NOT NULL DEFAULT 1"),
        ("ShowPaymentMethod",  "BOOLEAN NOT NULL DEFAULT 1"),
    ]

    with engine.connect() as conn:
        for col_name, col_def in new_columns:
            add_column_if_missing(conn, "printer_settings", col_name, col_def)
        conn.commit()

    print("\nMigration complete.")


if __name__ == "__main__":
    migrate()
