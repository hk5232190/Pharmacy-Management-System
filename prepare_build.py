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

# Verify: make sure no sensitive data leaked in
verify_conn = engine.connect()
try:
    from sqlalchemy import text
    users = verify_conn.execute(text("SELECT Username FROM users")).fetchall()
    profiles = verify_conn.execute(text("SELECT * FROM pharmacy_profile")).fetchall()
    
    usernames = [u[0] for u in users]
    if set(usernames) - {"admin"}:
        raise RuntimeError(f"ABORT: Unexpected users in clean DB: {usernames}")
    if profiles:
        raise RuntimeError(f"ABORT: Pharmacy profile data found in clean DB: {profiles}")
    
    print(f"[prepare_build] Verification passed. Users: {usernames}, Profiles: {profiles}")
finally:
    verify_conn.close()

engine.dispose()

print(f"\n[prepare_build] Clean template database ready at:")
print(f"   {OUTPUT_DB}")
print(f"\nSize: {os.path.getsize(OUTPUT_DB):,} bytes")
print("\nNow run your PyInstaller build command.\n")
