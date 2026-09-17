from fastapi import FastAPI
from api.router import create_api_router
from core.config import settings
from core.logger import logger
from core.exceptions import (
    PMSException, 
    pms_exception_handler, 
    general_exception_handler
)

from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI with loaded settings
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url=f"{settings.API_V1_STR}/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

from fastapi.staticfiles import StaticFiles
import os

# Create uploads dir if not exists
os.makedirs("uploads/logo", exist_ok=True)
os.makedirs("uploads/background", exist_ok=True)
os.makedirs("uploads/profile", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    # Origins are configured via the CORS_ORIGINS environment variable
    # (comma-separated). The default list covers Next.js dev and the Tauri
    # WebView. Keep this explicit (rather than "*") because authenticated API
    # calls carry credentials/tokens and wildcard origins are not production-safe.
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(create_api_router(settings.API_V1_STR))

# Register Custom Exception Handlers
app.add_exception_handler(PMSException, pms_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

import threading
from datetime import datetime, timedelta

def run_startup_backup_job():
    """Runs a single automatic backup on application startup (if enabled & cooldown passed)."""
    from database import SessionLocal
    from api.v1.backup import execute_backup
    from models import BackupSettings
    db = SessionLocal()
    try:
        settings = db.query(BackupSettings).first()
        if not settings or not settings.IsAutoBackupEnabled:
            return
        logger.info("Executing startup automatic backup...")
        execute_backup(
            db,
            f"StartupBackup_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}",
            settings.BackupLocation,
            settings.CompressBackup,
            "Automatic"
        )
    except Exception as e:
        logger.error(f"Startup backup failed: {e}")
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.PROJECT_NAME} backend...")

    from database import SessionLocal, engine
    from models import BackupSettings, BackupHistory

    # ── Schema: single authority = Alembic (Problem #4) ─────────────────────
    # All historical inline DDL (CurrencySymbol, BackupOnExit, and the
    # notifications table) was removed in favour of the programmatic Alembic
    # runner. The runner is guarded + idempotent, never raises, and never
    # touches a database it could harm — preserving the exact startup behaviour
    # of the previous inline migrations on BOTH clean and existing databases.
    from core.migrations import run_migrations
    run_migrations(engine)

    db = SessionLocal()
    try:
        # ── System notifications (data seed only — schema owned by Alembic) ──
        try:
            from utils.notification_service import sync_system_notifications
            sync_system_notifications(db)
            logger.info("Completed startup system notifications synchronization.")
        except Exception as e:
            logger.error(f"Error initializing notifications on startup: {e}")

        # ── Backup on Startup ────────────────────────────────────────────────
        db_settings = db.query(BackupSettings).first()
        if db_settings and db_settings.BackupOnStartup and db_settings.IsAutoBackupEnabled:
            last_backup = (
                db.query(BackupHistory)
                .filter(BackupHistory.BackupType == "Automatic", BackupHistory.Status == "Success")
                .order_by(BackupHistory.CreatedAt.desc())
                .first()
            )
            if not last_backup or datetime.utcnow() - last_backup.CreatedAt > timedelta(hours=24):
                logger.info("Triggering Startup Backup (cooldown passed)...")
                threading.Thread(target=run_startup_backup_job, daemon=True).start()
            else:
                logger.info("Skipping Startup Backup (24-hour cooldown active).")
    finally:
        db.close()

@app.get("/")
def read_root():
    logger.info("Root endpoint accessed")
    return {"status": "ok", "message": f"{settings.PROJECT_NAME} Backend is running"}
