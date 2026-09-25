"""
prepare_build.py — Run BEFORE every PyInstaller build.

Creates build_assets/clean_pharma_db.sqlite:
  - All tables from models.py (via SQLAlchemy metadata)
  - Zero real user/pharmacy data
  - One default 'admin' / 'admin' user (so fresh installs can log in)
  - Zero sales, purchases, medicines, categories, etc.

This file is what gets bundled as the data_template database.
The development database (backend/pharma_db.sqlite) is NEVER shipped.
"""

import sys
import os
import shutil

# Add backend to sys.path so we can import our models
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
sys.path.insert(0, BACKEND_DIR)

# Output path
OUTPUT_DIR = os.path.join(REPO_ROOT, "build_assets")
OUTPUT_DB = os.path.join(OUTPUT_DIR, "clean_pharma_db.sqlite")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Remove any stale copy
if os.path.exists(OUTPUT_DB):
    os.remove(OUTPUT_DB)
    print(f"[prepare_build] Removed stale: {OUTPUT_DB}")

# Temporarily point DATABASE_URL at our new empty file
os.environ["DATABASE_URL"] = f"sqlite:///{OUTPUT_DB.replace(os.sep, '/')}"

# Import models and create all tables
print("[prepare_build] Creating tables...")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(
    f"sqlite:///{OUTPUT_DB.replace(os.sep, '/')}",
    connect_args={"check_same_thread": False},
)

import models
from models import Base, User

Base.metadata.create_all(bind=engine)
print("[prepare_build] All tables created.")

# Seed only the default admin user
Session = sessionmaker(bind=engine)
db = Session()

try:
    existing = db.query(User).filter_by(Username="admin").first()
    if not existing:
        from core.security import get_password_hash_and_salt
        hash_str, salt_str = get_password_hash_and_salt("admin")
        admin = User(
            Username="admin",
            PasswordHash=hash_str,
            Salt=salt_str,
            IsActive=True,
            Role="admin",
        )
        db.add(admin)
        db.commit()
        print("[prepare_build] Seeded default admin user.")
    else:
        print("[prepare_build] Default admin already present.")
finally:
    db.close()

# Stamp alembic_version to head so the database is officially at the latest schema version
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

alembic_cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
alembic_cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{OUTPUT_DB.replace(os.sep, '/')}")
command.stamp(alembic_cfg, "head")
head_rev = ScriptDirectory.from_config(alembic_cfg).get_current_head()
print(f"[prepare_build] Stamped alembic_version to head ({head_rev}).")

# Verify: make sure no sensitive data leaked in and all critical columns exist
verify_conn = engine.connect()
try:
    from sqlalchemy import text
    users = verify_conn.execute(text("SELECT Username FROM users")).fetchall()
    usernames = [u[0] for u in users]
    if set(usernames) - {"admin"}:
        raise RuntimeError(f"ABORT: Unexpected users in clean DB: {usernames}")

    # Verify zero business data
    for table in ["medicines", "categories", "companies", "suppliers", "customers", "sales", "purchases", "stock_batches"]:
        count = verify_conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
        if count != 0:
            raise RuntimeError(f"ABORT: Clean DB contains {count} rows in {table}!")

    # Verify critical columns
    stock_cols = [row[1] for row in verify_conn.execute(text("PRAGMA table_info(stock_batches)")).fetchall()]
    if "Source" not in stock_cols:
        raise RuntimeError("ABORT: stock_batches.Source missing in clean DB!")

    billing_cols = [row[1] for row in verify_conn.execute(text("PRAGMA table_info(billing_settings)")).fetchall()]
    if "DefaultDiscountRate" not in billing_cols:
        raise RuntimeError("ABORT: billing_settings.DefaultDiscountRate missing in clean DB!")

    # Verify customer_payments table
    tables = [row[0] for row in verify_conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
    if "customer_payments" not in tables:
        raise RuntimeError("ABORT: customer_payments table missing in clean DB!")

    # Verify alembic stamp
    stamped_rev = verify_conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    if stamped_rev != head_rev:
        raise RuntimeError(f"ABORT: alembic stamp mismatch ({stamped_rev} != {head_rev})!")

    print(f"[prepare_build] All verifications passed successfully!")
    print(f"  - Users: {usernames}")
    print(f"  - Schema head: {head_rev}")
    print(f"  - stock_batches.Source: PRESENT")
    print(f"  - billing_settings.DefaultDiscountRate: PRESENT")
    print(f"  - customer_payments table: PRESENT")
    print(f"  - Zero data in business tables: CONFIRMED")
finally:
    verify_conn.close()

engine.dispose()

print(f"\n[prepare_build] Clean template database ready at:")
print(f"   {OUTPUT_DB}")
print(f"\nSize: {os.path.getsize(OUTPUT_DB):,} bytes\n")

