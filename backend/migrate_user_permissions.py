"""
Migration: Add Permissions column to users table.

Safe to run multiple times — uses PRAGMA to check column existence first.
Backfills existing cashier rows with '["sales"]'.
"""
import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "pharma_db.sqlite")

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if Permissions column already exists
    cur.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cur.fetchall()]

    if "Permissions" not in cols:
        print("Adding Permissions column to users table...")
        cur.execute("ALTER TABLE users ADD COLUMN Permissions TEXT DEFAULT '[\"sales\"]'")
        print("  Column added.")
    else:
        print("Permissions column already exists — skipping ALTER.")

    # Backfill: any cashier with NULL permissions gets the default
    cur.execute(
        "UPDATE users SET Permissions = ? WHERE Role = 'cashier' AND (Permissions IS NULL OR Permissions = '')",
        (json.dumps(["sales"]),)
    )
    print(f"  Backfilled {cur.rowcount} cashier row(s) with default permissions.")

    # Admins get NULL (they bypass the column entirely)
    cur.execute(
        "UPDATE users SET Permissions = NULL WHERE Role = 'admin'"
    )
    print(f"  Cleared permissions for {cur.rowcount} admin row(s) (not needed).")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    run()
