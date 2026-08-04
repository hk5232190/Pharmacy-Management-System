from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import json
from utils.hwid import generate_hwid
from utils.license_engine import validate_license
from core.exceptions import PMSException

router = APIRouter()

LICENSE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "licenses")
ACTIVE_LICENSE_PATH = os.path.join(LICENSE_DIR, "active.lic")

@router.get("/hwid", summary="Get Hardware ID", description="Returns the securely generated Hardware ID (fingerprint) of this machine.")
def get_hardware_id():
    """
    Computes and returns the Hardware ID using SHA256(CPU_ID + Motherboard_UUID + MAC_Address)
    """
    hwid = generate_hwid()
    return {"hwid": hwid}

from pydantic import BaseModel

class LicenseActivationRequest(BaseModel):
    license_key: str

@router.post("/activate", summary="Activate License")
async def activate_license(request: LicenseActivationRequest):
    """
    Accepts a license key string, validates it, and if valid, saves it as the active license.
    """
    if not request.license_key.strip():
        raise HTTPException(status_code=400, detail="License key is required")
        
    # Remove any whitespace or newlines that may have been introduced when copy-pasting
    cleaned_key = "".join(request.license_key.split())
    
    # PyJWT expects bytes or str, we can use the string directly or encode it
    content = cleaned_key.encode('utf-8')
    try:
        # Validate immediately before saving
        license_data = validate_license(content)
        
        # Ensure directory exists
        os.makedirs(LICENSE_DIR, exist_ok=True)
        
        # Save securely
        with open(ACTIVE_LICENSE_PATH, 'wb') as f:
            f.write(content)
            
        return {"status": "success", "message": "License activated successfully", "data": license_data}
    except PMSException as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process license key")

@router.get("/status", summary="Get License Status")
def get_license_status():
    """
    Checks if an active license exists and validates it.
    """
    if not os.path.exists(ACTIVE_LICENSE_PATH):
        return {"status": "Missing", "message": "No active license found"}
        
    try:
        with open(ACTIVE_LICENSE_PATH, 'rb') as f:
            content = f.read()
            
        license_data = validate_license(content)
        return {"status": "Active", "data": license_data}
    except PMSException as e:
        return {"status": "Invalid", "message": str(e)}
    except Exception as e:
        return {"status": "Error", "message": "Could not read license"}

