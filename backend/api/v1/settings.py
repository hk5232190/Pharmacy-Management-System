from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Any
import os
import shutil

from api.deps import get_db
from models import PharmacyProfile, BillingSettings, InventorySettings, PrinterSettings
from schemas.settings import PharmacyProfileResponse, PharmacyProfileUpdate, BillingSettingsResponse, BillingSettingsUpdate, InventorySettingsResponse, InventorySettingsUpdate, PrinterSettingsResponse, PrinterSettingsUpdate

router = APIRouter()

UPLOAD_DIR = Path("uploads/logo")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
    db: Session = Depends(get_db)
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
    return profile

@router.post("/profile/logo")
def upload_pharmacy_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
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
        
    # Generate unique filename or just overwrite logo.png
    file_extension = file.filename.split(".")[-1]
    filename = f"logo_{profile.ProfileId}.{file_extension}"
    file_path = UPLOAD_DIR / filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    profile.LogoPath = f"/uploads/logo/{filename}"
    db.commit()
    db.refresh(profile)
    
    return {"message": "Logo uploaded successfully", "logo_path": profile.LogoPath}

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
        # Enforce SRS Module 5 constraint strictly
        settings.PreventSaleOfExpired = True
        db.add(settings)
    else:
        update_data = settings_in.model_dump(exclude_unset=True)
        # Enforce SRS Module 5 constraint strictly overriding any API manipulation
        update_data['PreventSaleOfExpired'] = True
        
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
