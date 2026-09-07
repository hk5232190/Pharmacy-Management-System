from fastapi import FastAPI, APIRouter
from fastapi.exceptions import RequestValidationError
from core.config import settings
from core.logger import logger
from core.exceptions import (
    PMSException, 
    pms_exception_handler, 
    general_exception_handler
)

from api.v1 import license, auth, category, company, supplier, customer, medicine, purchase, purchase_return, inventory, sales, dashboard, reports, backup, backup_settings, settings as pms_settings, security, about, system, notification

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
    allow_origins=["http://localhost:3000"], # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define API Router
api_router = APIRouter(prefix=settings.API_V1_STR)

# Register Routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(license.router, prefix="/license", tags=["License"])
api_router.include_router(category.router, prefix="/categories", tags=["Categories"])
api_router.include_router(company.router, prefix="/companies", tags=["Companies"])
api_router.include_router(supplier.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(customer.router, prefix="/customers", tags=["Customers"])
api_router.include_router(medicine.router, prefix="/medicines", tags=["Medicines"])
api_router.include_router(purchase.router, prefix="/purchases", tags=["Purchases"])
api_router.include_router(purchase_return.router, prefix="/purchase-returns", tags=["Purchase Returns"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(backup.router, prefix="/backup", tags=["Backup & Restore"])
api_router.include_router(backup_settings.router, prefix="/backup-settings", tags=["Backup Settings"])
api_router.include_router(pms_settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(security.router)
api_router.include_router(about.router, prefix="/about", tags=["About"])
api_router.include_router(system.router, prefix="/system", tags=["System Diagnostics"])
api_router.include_router(notification.router, prefix="/notifications", tags=["Notifications"])

app.include_router(api_router)

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
    from sqlalchemy import text

    db = SessionLocal()
    try:
        # ── Inline migrations ────────────────────────────────────────────────
        try:
            result = db.execute(text("PRAGMA table_info(billing_settings)")).fetchall()
            columns = [row[1] for row in result]
            if "CurrencySymbol" not in columns:
                logger.info("Migrating billing_settings: adding CurrencySymbol column.")
                db.execute(text("ALTER TABLE billing_settings ADD COLUMN CurrencySymbol VARCHAR(10) DEFAULT 'Rs'"))
                db.commit()
        except Exception as e:
            logger.error(f"Migration error for CurrencySymbol: {e}")

        # Add BackupOnExit column if it doesn't exist (safe for existing DBs)
        try:
            result = db.execute(text("PRAGMA table_info(backup_settings)")).fetchall()
            columns = [row[1] for row in result]
            if "BackupOnExit" not in columns:
                logger.info("Migrating backup_settings: adding BackupOnExit column.")
                db.execute(text("ALTER TABLE backup_settings ADD COLUMN BackupOnExit BOOLEAN DEFAULT 1"))
                db.commit()
        except Exception as e:
            logger.error(f"Migration error for BackupOnExit: {e}")

        # ── Notifications ────────────────────────────────────────────────────
        try:
            from models import Notification
            Notification.__table__.create(bind=engine, checkfirst=True)
            logger.info("Verified notifications table in database.")
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


