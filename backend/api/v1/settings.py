from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Any
import os
import shutil
import uuid

from api.deps import get_db, get_current_admin_user
from models import PharmacyProfile, BillingSettings, InventorySettings, PrinterSettings, SystemPreferences, GeneralSettings
from schemas.settings import PharmacyProfileResponse, PharmacyProfileUpdate, BillingSettingsResponse, BillingSettingsUpdate, InventorySettingsResponse, InventorySettingsUpdate, PrinterSettingsResponse, PrinterSettingsUpdate, SystemPreferencesResponse, SystemPreferencesUpdate, GeneralSettingsResponse, GeneralSettingsUpdate
from core.logger import logger

router = APIRouter()

UPLOAD_DIR = Path("uploads/logo")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR_BG = Path("uploads/background")
UPLOAD_DIR_BG.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]
MAX_FILE_SIZE = 5 * 1024 * 1024 # 5MB

@router.get("/profile", response_model=PharmacyProfileResponse)
def get_pharmacy_profile(db: Session = Depends(get_db)) -> Any:
    """
    Get the current pharmacy profile. If none exists, return a default empty profile.
    """
    profile = db.query(PharmacyProfile).first()
    if not profile:
        profile = PharmacyProfile(PharmacyName="My Pharmacy")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/profile", response_model=PharmacyProfileResponse)
def update_pharmacy_profile(
    profile_in: PharmacyProfileUpdate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Update the pharmacy profile.
    """
    profile = db.query(PharmacyProfile).first()
    if not profile:
        profile = PharmacyProfile(**profile_in.model_dump())
        db.add(profile)
    else:
        update_data = profile_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
            
    db.commit()
    db.refresh(profile)
    logger.info(f"AUDIT: User {current_admin.Username} updated Pharmacy Branding (Name/Profile).")
    return profile

@router.post("/profile/logo")
def upload_pharmacy_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Upload a logo for the pharmacy profile.
    """
    profile = db.query(PharmacyProfile).first()
    if not profile:
        profile = PharmacyProfile(PharmacyName="My Pharmacy")
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG, JPEG, and WebP are allowed.")
        
    # Read file content to check size and save
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit.")
        
    # Generate unique filename or just overwrite logo.png
    file_extension = file.filename.split(".")[-1]
    filename = f"logo_{profile.ProfileId}.{file_extension}"
    file_path = UPLOAD_DIR / filename
    
    # Disk cleanup of previous logo if it exists and is different
    if profile.LogoPath:
        old_file_path = Path(profile.LogoPath.lstrip("/"))
        if old_file_path.exists() and old_file_path != file_path:
            try:
                os.unlink(old_file_path)
            except Exception as e:
                logger.error(f"Failed to delete old logo file {old_file_path}: {e}")
    
    with file_path.open("wb") as buffer:
        buffer.write(content)
        
    profile.LogoPath = f"/uploads/logo/{filename}"
    db.commit()
    db.refresh(profile)
    logger.info(f"AUDIT: User {current_admin.Username} uploaded a new Pharmacy Logo.")
    
    return {"message": "Logo uploaded successfully", "logo_path": profile.LogoPath}

@router.delete("/profile/logo")
def delete_pharmacy_logo(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Remove the pharmacy logo.
    """
    profile = db.query(PharmacyProfile).first()
    if not profile or not profile.LogoPath:
        raise HTTPException(status_code=404, detail="No logo found.")
        
    old_file_path = Path(profile.LogoPath.lstrip("/"))
    if old_file_path.exists():
        try:
            os.unlink(old_file_path)
        except Exception as e:
            logger.error(f"Failed to delete logo file {old_file_path}: {e}")
            
    profile.LogoPath = None
    db.commit()
    db.refresh(profile)
    logger.info(f"AUDIT: User {current_admin.Username} removed the Pharmacy Logo.")
    
    return {"message": "Logo removed successfully"}

@router.post("/profile/receipt-logo")
def upload_receipt_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Upload a receipt logo for the pharmacy profile.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Ensure upload directory exists
    upload_dir = Path("uploads/logo")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix
    filename = f"receipt_logo_{uuid.uuid4().hex}{file_ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    profile = db.query(PharmacyProfile).first()
    if not profile:
        profile = PharmacyProfile()
        db.add(profile)
        
    # Delete old receipt logo if it exists
    if profile.ReceiptLogoPath:
        old_file_path = Path(profile.ReceiptLogoPath.lstrip("/"))
        if old_file_path.exists():
            try:
                os.unlink(old_file_path)
            except Exception as e:
                logger.error(f"Failed to delete old receipt logo file {old_file_path}: {e}")

    profile.ReceiptLogoPath = f"/uploads/logo/{filename}"
    db.commit()
    db.refresh(profile)
    logger.info(f"AUDIT: User {current_admin.Username} uploaded a new Receipt Logo.")
    
    return {"message": "Receipt Logo uploaded successfully", "logo_path": profile.ReceiptLogoPath}

@router.delete("/profile/receipt-logo")
def delete_receipt_logo(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Remove the receipt logo.
    """
    profile = db.query(PharmacyProfile).first()
    if not profile or not profile.ReceiptLogoPath:
        raise HTTPException(status_code=404, detail="No receipt logo found.")
        
    old_file_path = Path(profile.ReceiptLogoPath.lstrip("/"))
    if old_file_path.exists():
        try:
            os.unlink(old_file_path)
        except Exception as e:
            logger.error(f"Failed to delete receipt logo file {old_file_path}: {e}")
            
    profile.ReceiptLogoPath = None
    db.commit()
    db.refresh(profile)
    logger.info(f"AUDIT: User {current_admin.Username} removed the Receipt Logo.")
    
    return {"message": "Receipt Logo removed successfully"}

@router.get("/billing", response_model=BillingSettingsResponse)
def get_billing_settings(db: Session = Depends(get_db)) -> Any:
    """
    Get the current billing & POS settings. If none exists, return defaults.
    """
    settings = db.query(BillingSettings).first()
    if not settings:
        settings = BillingSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/billing", response_model=BillingSettingsResponse)
def update_billing_settings(
    settings_in: BillingSettingsUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update the billing & POS settings.
    """
    settings = db.query(BillingSettings).first()
    if not settings:
        settings = BillingSettings(**settings_in.model_dump())
        db.add(settings)
    else:
        update_data = settings_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)
            
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/inventory", response_model=InventorySettingsResponse)
def get_inventory_settings(db: Session = Depends(get_db)) -> Any:
    """
    Get the current inventory & medicine settings. If none exists, return defaults.
    """
    settings = db.query(InventorySettings).first()
    if not settings:
        settings = InventorySettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/inventory", response_model=InventorySettingsResponse)
def update_inventory_settings(
    settings_in: InventorySettingsUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update the inventory & medicine settings.
    """
    settings = db.query(InventorySettings).first()
    if not settings:
        settings = InventorySettings(**settings_in.model_dump())
        db.add(settings)
    else:
        update_data = settings_in.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(settings, field, value)
            
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/printer", response_model=PrinterSettingsResponse)
def get_printer_settings(db: Session = Depends(get_db)) -> Any:
    """
    Get the current printer settings. If none exists, return defaults.
    """
    settings = db.query(PrinterSettings).first()
    if not settings:
        settings = PrinterSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/printer", response_model=PrinterSettingsResponse)
def update_printer_settings(
    settings_in: PrinterSettingsUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update the printer settings.
    """
    settings = db.query(PrinterSettings).first()
    if not settings:
        settings = PrinterSettings(**settings_in.model_dump())
        db.add(settings)
    else:
        update_data = settings_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)
            
    db.commit()
    db.refresh(settings)
    return settings

@router.post("/printer/test")
def test_printer_connection(db: Session = Depends(get_db)) -> Any:
    """
    Endpoint to test ESC/POS printing (simulated for now, would connect to hardware in prod).
    """
    settings = db.query(PrinterSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Printer settings not configured.")
        
    return {
        "status": "success",
        "message": f"Successfully sent test payload to {settings.SelectedPrinterName or 'Default Printer'} on {settings.ConnectionPort}"
    }

@router.get("/appearance", response_model=SystemPreferencesResponse)
def get_system_preferences(db: Session = Depends(get_db)) -> Any:
    """
    Get the current system appearance and preferences. If none exists, return defaults.
    """
    settings = db.query(SystemPreferences).first()
    if not settings:
        settings = SystemPreferences()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/appearance", response_model=SystemPreferencesResponse)
def update_system_preferences(
    settings_in: SystemPreferencesUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update the system appearance and preferences.
    """
    settings = db.query(SystemPreferences).first()
    if not settings:
        settings = SystemPreferences(**settings_in.model_dump())
        db.add(settings)
    else:
        update_data = settings_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)
            
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/general", response_model=GeneralSettingsResponse)
def get_general_settings(db: Session = Depends(get_db)) -> Any:
    """
    Get the general settings (Login Page Branding). This is a public endpoint.
    """
    settings = db.query(GeneralSettings).first()
    if not settings:
        settings = GeneralSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/general", response_model=GeneralSettingsResponse)
def update_general_settings(
    settings_in: GeneralSettingsUpdate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Update the general settings (Login Page Branding).
    """
    settings = db.query(GeneralSettings).first()
    if not settings:
        settings = GeneralSettings(**settings_in.model_dump())
        db.add(settings)
    else:
        update_data = settings_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)
            
    db.commit()
    db.refresh(settings)
    logger.info(f"AUDIT: User {current_admin.Username} updated General Settings (Login Page Branding).")
    return settings

@router.post("/general/background")
def upload_login_background(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Upload a background image for the login page.
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG, JPEG, and WebP are allowed.")
        
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit.")
        
    settings = db.query(GeneralSettings).first()
    if not settings:
        settings = GeneralSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
    file_extension = file.filename.split(".")[-1]
    filename = f"bg_{settings.SettingsId}.{file_extension}"
    file_path = UPLOAD_DIR_BG / filename
    
    if settings.LoginBackgroundPath:
        old_file_path = Path(settings.LoginBackgroundPath.lstrip("/"))
        if old_file_path.exists() and old_file_path != file_path:
            try:
                os.unlink(old_file_path)
            except Exception as e:
                logger.error(f"Failed to delete old background file {old_file_path}: {e}")
                
    with file_path.open("wb") as buffer:
        buffer.write(content)
        
    settings.LoginBackgroundPath = f"/uploads/background/{filename}"
    db.commit()
    db.refresh(settings)
    logger.info(f"AUDIT: User {current_admin.Username} uploaded a new Login Background.")
    
    return {"message": "Background uploaded successfully", "background_path": settings.LoginBackgroundPath}

@router.delete("/general/background")
def delete_login_background(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
) -> Any:
    """
    Remove the login page background image.
    """
    settings = db.query(GeneralSettings).first()
    if not settings or not settings.LoginBackgroundPath:
        raise HTTPException(status_code=404, detail="No background found.")
        
    old_file_path = Path(settings.LoginBackgroundPath.lstrip("/"))
    if old_file_path.exists():
        try:
            os.unlink(old_file_path)
        except Exception as e:
            logger.error(f"Failed to delete background file {old_file_path}: {e}")
            
    settings.LoginBackgroundPath = None
    db.commit()
    db.refresh(settings)
    logger.info(f"AUDIT: User {current_admin.Username} removed the Login Background.")
    
    return {"message": "Background removed successfully"}
