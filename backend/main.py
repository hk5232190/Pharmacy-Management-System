from fastapi import FastAPI, APIRouter
from fastapi.exceptions import RequestValidationError
from core.config import settings
from core.logger import logger
from core.exceptions import (
    PMSException, 
    pms_exception_handler, 
    general_exception_handler
)

from api.v1 import license, auth, category, company, supplier, customer, medicine, purchase, purchase_return, inventory, sales, dashboard, reports, backup, backup_settings

from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI with loaded settings
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url=f"{settings.API_V1_STR}/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

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

app.include_router(api_router)

# Register Custom Exception Handlers
app.add_exception_handler(PMSException, pms_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

import threading
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler

def run_automatic_backup_job():
    from database import SessionLocal
    from api.v1.backup import execute_backup, verify_backup
    from models import BackupSettings
    db = SessionLocal()
    try:
        settings = db.query(BackupSettings).first()
        if not settings or not settings.IsAutoBackupEnabled:
            return
        logger.info("Executing scheduled automatic backup...")
        record = execute_backup(db, f"AutoBackup_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}", settings.BackupLocation, settings.CompressBackup, "Automatic")
        
        if settings.AutoVerify and record and record.Status == "Success":
            logger.info("AutoVerify enabled. Running deep verification on new automatic backup...")
            report = verify_backup(record.BackupId, db, current_user=None)
            logger.info(f"Verification complete. Overall status: {report.get('overall')}")
            
    except Exception as e:
        logger.error(f"Automatic backup failed: {e}")
    finally:
        db.close()

def schedule_backup_job(settings):
    if hasattr(app.state, 'scheduler') and app.state.scheduler:
        try:
            app.state.scheduler.remove_job("auto_backup_job")
        except:
            pass
        if settings.IsAutoBackupEnabled:
            try:
                hour, minute = settings.BackupTime.split(":")
                if settings.BackupFrequency == "Daily":
                    app.state.scheduler.add_job(run_automatic_backup_job, 'cron', hour=hour, minute=minute, id="auto_backup_job")
                elif settings.BackupFrequency == "Weekly":
                    app.state.scheduler.add_job(run_automatic_backup_job, 'cron', day_of_week='sun', hour=hour, minute=minute, id="auto_backup_job")
                elif settings.BackupFrequency == "Monthly":
                    app.state.scheduler.add_job(run_automatic_backup_job, 'cron', day='1', hour=hour, minute=minute, id="auto_backup_job")
                logger.info(f"Scheduled automatic backup for {settings.BackupFrequency} at {settings.BackupTime}")
            except Exception as e:
                logger.error(f"Failed to schedule backup job: {e}")

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.PROJECT_NAME} backend...")
    
    app.state.scheduler = BackgroundScheduler()
    app.state.scheduler.start()
    app.state.reschedule_backup_job = schedule_backup_job
    
    from database import SessionLocal
    from models import BackupSettings, BackupHistory
    
    db = SessionLocal()
    try:
        db_settings = db.query(BackupSettings).first()
        if db_settings:
            schedule_backup_job(db_settings)
            
            if db_settings.BackupOnStartup:
                last_backup = db.query(BackupHistory).filter(BackupHistory.BackupType == "Automatic", BackupHistory.Status == "Success").order_by(BackupHistory.CreatedAt.desc()).first()
                if not last_backup or datetime.utcnow() - last_backup.CreatedAt > timedelta(hours=24):
                    logger.info("Triggering Startup Backup (Cooldown passed)...")
                    threading.Thread(target=run_automatic_backup_job, daemon=True).start()
                else:
                    logger.info("Skipping Startup Backup (24-hour cooldown active).")
    finally:
        db.close()

@app.get("/")
def read_root():
    logger.info("Root endpoint accessed")
    return {"status": "ok", "message": f"{settings.PROJECT_NAME} Backend is running"}

