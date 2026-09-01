import os
import sqlite3
import shutil
import glob
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from api.deps import get_db, get_current_user
from models import User, SecuritySettings
from core.security import verify_password, get_password_hash_and_salt
from core.logger import logger
from database import SQLALCHEMY_DATABASE_URL

router = APIRouter(prefix="/security", tags=["Security & Maintenance"])

# ─── Schemas ─────────────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SecuritySettingsResponse(BaseModel):
    AutoLockEnabled: bool
    AutoLockMinutes: int
    SessionTimeoutEnabled: bool
    SessionTimeoutMinutes: int

    class Config:
        from_attributes = True

class SecuritySettingsUpdate(BaseModel):
    AutoLockEnabled: bool
    AutoLockMinutes: int
    SessionTimeoutEnabled: bool
    SessionTimeoutMinutes: int

class AuditLogRequest(BaseModel):
    event: str
    description: str

class SafeResetRequest(BaseModel):
    password: str
    confirmation_phrase: str   # Must be exactly "RESET ALL DATA"

class LogsResponse(BaseModel):
    lines: list[str]
    total: int

# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_db_path() -> str:
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite:///"):
        return SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
    return "pharma_db.sqlite"

def get_or_create_security_settings(db: Session) -> SecuritySettings:
    s = db.query(SecuritySettings).first()
    if not s:
        s = SecuritySettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

# ─── Change Password ──────────────────────────────────────────────────────────

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change current user's password with PBKDF2 re-verification."""
    if not verify_password(req.current_password, current_user.PasswordHash, current_user.Salt):
        logger.warning(f"Change Password | Failed (bad current password) | User: {current_user.Username}")
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    new_hash, new_salt = get_password_hash_and_salt(req.new_password)
    current_user.PasswordHash = new_hash
    current_user.Salt = new_salt
    db.commit()

    logger.info(f"Change Password | Success | User: {current_user.Username}")
    return {"status": "ok", "message": "Password changed successfully."}

# ─── Security Settings (Auto-Lock / Session Timeout) ─────────────────────────

@router.get("/settings", response_model=SecuritySettingsResponse)
def get_security_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_or_create_security_settings(db)

@router.put("/settings", response_model=SecuritySettingsResponse)
def update_security_settings(
    update: SecuritySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = get_or_create_security_settings(db)
    s.AutoLockEnabled = update.AutoLockEnabled
    s.AutoLockMinutes = update.AutoLockMinutes
    s.SessionTimeoutEnabled = update.SessionTimeoutEnabled
    s.SessionTimeoutMinutes = update.SessionTimeoutMinutes
    db.commit()
    db.refresh(s)
    logger.info(f"Security Settings Updated | User: {current_user.Username} | AutoLock: {s.AutoLockEnabled} ({s.AutoLockMinutes}m) | SessionTimeout: {s.SessionTimeoutEnabled} ({s.SessionTimeoutMinutes}m)")
    return s

# ─── Database Optimization ────────────────────────────────────────────────────

@router.post("/db-optimize")
def optimize_database(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run VACUUM (reclaim space) and ANALYZE (rebuild query stats) on the live SQLite database."""
    db_path = get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        before_size = os.path.getsize(db_path)
        conn.execute("VACUUM;")
        conn.execute("ANALYZE;")
        conn.close()
        after_size = os.path.getsize(db_path)
        reclaimed = before_size - after_size
        logger.info(f"Database Optimization | User: {current_user.Username} | Reclaimed: {reclaimed} bytes")
        return {
            "status": "ok",
            "message": "Database optimized successfully.",
            "before_size_bytes": before_size,
            "after_size_bytes": after_size,
            "reclaimed_bytes": reclaimed
        }
    except Exception as e:
        logger.error(f"Database Optimization Failed | Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

# ─── Integrity Check ──────────────────────────────────────────────────────────

@router.get("/db-integrity")
def check_integrity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Full SQLite PRAGMA integrity_check with table count and schema version."""
    db_path = get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Full integrity check (returns list of errors or 'ok')
        cursor.execute("PRAGMA integrity_check;")
        integrity_rows = cursor.fetchall()
        integrity_ok = len(integrity_rows) == 1 and integrity_rows[0][0] == "ok"

        # Foreign key check
        cursor.execute("PRAGMA foreign_key_check;")
        fk_violations = cursor.fetchall()

        # Table count
        cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        table_count = cursor.fetchone()[0]

        # Page count and free pages
        cursor.execute("PRAGMA page_count;")
        page_count = cursor.fetchone()[0]
        cursor.execute("PRAGMA freelist_count;")
        free_pages = cursor.fetchone()[0]

        # Alembic schema version
        try:
            cursor.execute("SELECT version_num FROM alembic_version;")
            schema_version = cursor.fetchone()
            schema_version = schema_version[0] if schema_version else "Unknown"
        except sqlite3.OperationalError:
            schema_version = "Unknown"

        conn.close()

        file_size = os.path.getsize(db_path)

        return {
            "integrity": "Passed" if integrity_ok else "Failed",
            "integrity_details": [r[0] for r in integrity_rows] if not integrity_ok else [],
            "foreign_key_violations": len(fk_violations),
            "table_count": table_count,
            "page_count": page_count,
            "free_pages": free_pages,
            "file_size_bytes": file_size,
            "schema_version": schema_version,
            "checked_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Integrity check failed: {str(e)}")

# ─── Application Logs ─────────────────────────────────────────────────────────

LOG_PATTERN = re.compile(r"^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3})\s-\s(.*?)\s-\s(.*?)\s-\s(.*)$")

@router.post("/audit-log", summary="Write to audit log")
def write_audit_log(
    req: AuditLogRequest,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"AUDIT: [{req.event}] {req.description} (User: {current_user.Username})")
    return {"message": "Logged"}

@router.get("/logs", summary="Get system logs")
def get_application_logs(
    level: str = "ALL",
    search: str = "",
    page: int = 1,
    page_size: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Read the app_audit.log file, newest entries first, paginated with filters."""
    log_file = Path("app_audit.log")
    if not log_file.exists():
        return {"lines": [], "total": 0}

    with open(log_file, "r", encoding="utf-8", errors="replace") as f:
        all_lines = f.readlines()

    parsed_lines = []
    for line in all_lines:
        line = line.strip()
        if not line:
            continue
        
        # Filter out apscheduler by default
        if "apscheduler" in line:
            continue
            
        match = LOG_PATTERN.match(line)
        if match:
            timestamp, module, log_level, message = match.groups()
            
            # Identify audit actions
            if message.startswith("AUDIT:"):
                log_level = "AUDIT"
                message = message[6:].strip() # remove "AUDIT: "
                
            parsed_lines.append({
                "timestamp": timestamp,
                "module": module,
                "level": log_level,
                "message": message,
                "raw": line
            })
        else:
            # Fallback for unparseable lines
            parsed_lines.append({
                "timestamp": "",
                "module": "",
                "level": "INFO",
                "message": line,
                "raw": line
            })
            
    # Apply filters
    filtered_lines = []
    search_lower = search.lower() if search else ""
    for entry in parsed_lines:
        if level != "ALL" and entry["level"] != level:
            continue
        if search_lower and search_lower not in entry["raw"].lower():
            continue
        filtered_lines.append(entry)
            
    # Newest first
    filtered_lines.reverse()
    total = len(filtered_lines)
    start = (page - 1) * page_size
    end = start + page_size
    page_lines = filtered_lines[start:end]

    return {"lines": page_lines, "total": total, "page": page, "page_size": page_size}

@router.get("/logs/export")
def export_application_logs(current_user: User = Depends(get_current_user)):
    """Export the raw log file."""
    log_file = Path("app_audit.log")
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="Log file not found.")
    return FileResponse(
        path=log_file,
        filename=f"app_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
        media_type="text/plain"
    )

# ─── Clear Temporary Data ────────────────────────────────────────────────────

@router.post("/clear-temp")
def clear_temp_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete files in the spooler directory, temp directories, and *.tmp/*.pdf in backend root."""
    deleted_files_count = 0
    reclaimed_bytes = 0
    errors = []

    def clear_dir(d_path: Path, pattern="*"):
        nonlocal deleted_files_count, reclaimed_bytes
        if d_path.exists() and d_path.is_dir():
            for f in d_path.glob(pattern):
                try:
                    if f.is_file():
                        size = f.stat().st_size
                        f.unlink()
                        deleted_files_count += 1
                        reclaimed_bytes += size
                except Exception as e:
                    errors.append(str(e))

    # Clear spooler, spool, and temp dirs
    clear_dir(Path("spooler"))
    clear_dir(Path("spool"))
    clear_dir(Path("temp"))

    # Clear *.tmp and *.pdf in backend root
    clear_dir(Path("."), "*.tmp")
    clear_dir(Path("."), "*.pdf")

    reclaimed_kb = reclaimed_bytes / 1024.0

    logger.info(f"Clear Temp Data | User: {current_user.Username} | Deleted {deleted_files_count} files | Reclaimed: {reclaimed_kb:.2f} KB")
    return {
        "status": "ok",
        "message": f"Cleared {deleted_files_count} temporary file(s).",
        "files_cleared": deleted_files_count,
        "size_reclaimed_kb": round(reclaimed_kb, 2),
        "errors": errors
    }

# ─── Safe Data Reset ─────────────────────────────────────────────────────────

# Tables to wipe in FK-safe dependency order (children before parents).
# Core config tables (billing, inventory, printer, security, profile, system_prefs, license, users)
# are intentionally preserved so the system stays operational after reset.
RESET_TABLE_ORDER = [
    "sale_return_items",      # child of sale_returns
    "sale_returns",           # references sales
    "sale_items",             # child of sales
    "sales",                  # top-level transactional
    "purchase_return_items",  # child of purchase_returns
    "purchase_returns",       # references purchases
    "purchase_items",         # child of purchases
    "purchases",              # top-level transactional
    "stock_adjustments",      # references stock_batches
    "stock_batches",          # references medicines
    "backup_history",         # standalone log table
    "audit_logs",             # audit trail (wiped on full reset)
    "medicines",              # references categories & companies
    "customers",
    "suppliers",
    "companies",
    "categories",
]

@router.post("/reset-data")
def safe_data_reset(
    req: SafeResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin-only: Wipe all transactional and master data.
    Requires password re-verification and exact confirmation phrase.
    Core settings tables (billing, inventory, printer, security, profile) are preserved.
    """
    # 1. Confirm phrase guard
    if req.confirmation_phrase != "RESET ALL DATA":
        raise HTTPException(status_code=400, detail='Confirmation phrase must be exactly: RESET ALL DATA')

    # 2. PBKDF2 password re-verification
    if not verify_password(req.password, current_user.PasswordHash, current_user.Salt):
        logger.warning(f"Safe Data Reset | Auth Failed | User: {current_user.Username}")
        raise HTTPException(status_code=401, detail="Invalid password. Reset aborted.")

    # 3. Create safety snapshot before reset
    db_path = Path(get_db_path())
    safety_dir = db_path.parent / "backups" / "safety"
    safety_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = safety_dir / f"pre_reset_snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite"
    src = sqlite3.connect(str(db_path))
    dst = sqlite3.connect(str(snapshot_path))
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()

    # 4. Delete data in dependency order
    try:
        for table in RESET_TABLE_ORDER:
            try:
                db.execute(text(f"DELETE FROM {table};"))
            except Exception as e:
                # Non-existent table is acceptable
                logger.warning(f"Safe Data Reset | Could not clear table '{table}': {e}")

        db.commit()
        
        # Run VACUUM to reclaim space outside of transaction
        try:
            conn = sqlite3.connect(str(db_path))
            conn.execute("VACUUM;")
            conn.close()
        except Exception as e:
            logger.warning(f"Safe Data Reset | Vacuum failed: {e}")
            
        logger.info(f"Safe Data Reset | SUCCESS | User: {current_user.Username} | Snapshot: {snapshot_path.name}")
        return {
            "status": "ok",
            "message": "Database reset successful. All transactional records have been deleted, but your system settings and user accounts were safely preserved.",
            "snapshot": snapshot_path.name
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Safe Data Reset | FAILED | User: {current_user.Username} | Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Data reset failed: {str(e)}")
