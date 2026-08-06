from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from api.deps import get_db, get_current_user
from models import BackupSettings, User
from schemas.backup_settings import BackupSettingsResponse, BackupSettingsUpdate

router = APIRouter()

def get_or_create_settings(db: Session) -> BackupSettings:
    settings = db.query(BackupSettings).first()
    if not settings:
        settings = BackupSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.get("", response_model=BackupSettingsResponse)
def get_backup_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_or_create_settings(db)

@router.put("", response_model=BackupSettingsResponse)
def update_backup_settings(
    update_data: BackupSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    settings = get_or_create_settings(db)
    for key, value in update_data.model_dump().items():
        setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    
    # Trigger APScheduler update
    if hasattr(request.app.state, "reschedule_backup_job"):
        request.app.state.reschedule_backup_job(settings)
        
    return settings
