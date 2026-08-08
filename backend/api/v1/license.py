from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import os
import json
import stat
import datetime
from utils.hwid import generate_hwid
from utils.license_engine import validate_license
from core.exceptions import PMSException
from api.deps import get_current_user
import models

router = APIRouter()

LICENSE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "licenses")
ACTIVE_LICENSE_PATH = os.path.join(LICENSE_DIR, "active.lic")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _key_reference(path: str) -> str:
    """Returns a masked key reference: first 12 + '...' + last 12 chars."""
    try:
        with open(path, "rb") as f:
            raw = f.read().decode("utf-8", errors="ignore").strip()
        if len(raw) <= 30:
            return raw
        return f"{raw[:12]}...{raw[-12:]}"
    except Exception:
        return "N/A"


def _file_info(path: str) -> dict:
    """Returns file size (bytes), last modified datetime string."""
    try:
        st = os.stat(path)
        modified = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        return {
            "size_bytes": st.st_size,
            "last_modified": modified,
            "file_name": "active.lic",
            "file_path": "licenses/active.lic",  # Masked relative path for security
        }
    except Exception:
        return {}


def _remaining_days(exp_ts) -> int | None:
    """Compute remaining days from a JWT exp timestamp."""
    if exp_ts is None:
        return None  # Lifetime license
    try:
        exp_dt = datetime.datetime.fromtimestamp(float(exp_ts), tz=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        delta = exp_dt - now
        return max(0, delta.days)
    except Exception:
        return None


# ─── Existing Endpoints (preserved) ─────────────────────────────────────────

@router.get("/hwid", summary="Get Hardware ID")
def get_hardware_id():
    """Computes and returns the Hardware ID: SHA256(CPU_ID + MB_UUID + MAC)."""
    hwid = generate_hwid()
    return {"hwid": hwid}


from pydantic import BaseModel


class LicenseActivationRequest(BaseModel):
    license_key: str


@router.post("/activate", summary="Activate License via Key")
async def activate_license(request: LicenseActivationRequest):
    """Accepts a JWT license key string, validates it, and saves as active license."""
    if not request.license_key.strip():
        raise HTTPException(status_code=400, detail="License key is required")

    cleaned_key = "".join(request.license_key.split())
    content = cleaned_key.encode("utf-8")

    try:
        license_data = validate_license(content)
        os.makedirs(LICENSE_DIR, exist_ok=True)
        with open(ACTIVE_LICENSE_PATH, "wb") as f:
            f.write(content)
        return {"status": "success", "message": "License activated successfully", "data": license_data}
    except PMSException as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to process license key")


@router.get("/status", summary="Quick License Status Check")
def get_license_status():
    """Quick check: returns status (Active/Missing/Invalid/Expired) and payload."""
    if not os.path.exists(ACTIVE_LICENSE_PATH):
        return {"status": "Missing", "message": "No active license found"}
    try:
        with open(ACTIVE_LICENSE_PATH, "rb") as f:
            content = f.read()
        license_data = validate_license(content)
        return {"status": "Active", "data": license_data}
    except PMSException as e:
        return {"status": "Invalid", "message": str(e)}
    except Exception:
        return {"status": "Error", "message": "Could not read license"}


# ─── New Enhanced Endpoints ───────────────────────────────────────────────────

@router.get("/info", summary="Full License Information")
def get_license_info():
    """
    Returns the complete license dashboard data:
    status, type, activation date, expiry date, remaining days,
    hardware ID, key reference, file metadata, and validation details.
    """
    hwid = generate_hwid()
    base = {
        "hardware_id": hwid,
        "license_file_info": _file_info(ACTIVE_LICENSE_PATH) if os.path.exists(ACTIVE_LICENSE_PATH) else {},
        "key_reference": _key_reference(ACTIVE_LICENSE_PATH) if os.path.exists(ACTIVE_LICENSE_PATH) else "N/A",
    }

    if not os.path.exists(ACTIVE_LICENSE_PATH):
        return {
            **base,
            "status": "Missing",
            "validation_message": "No license file found. Please activate a license.",
            "license_type": None,
            "activation_date": None,
            "expiry_date": None,
            "remaining_days": None,
            "client_name": None,
            "license_id": None,
            "is_lifetime": False,
        }

    try:
        with open(ACTIVE_LICENSE_PATH, "rb") as f:
            content = f.read()

        payload = validate_license(content)

        # Parse dates
        iat = payload.get("iat")
        exp = payload.get("exp")
        license_type = payload.get("type", "Unknown")
        is_lifetime = (license_type == "Lifetime" or exp is None)

        activation_date = None
        if iat:
            try:
                activation_date = datetime.datetime.fromtimestamp(float(iat), tz=datetime.timezone.utc).strftime("%Y-%m-%d")
            except Exception:
                activation_date = str(iat)

        expiry_date = None
        if exp and not is_lifetime:
            try:
                expiry_date = datetime.datetime.fromtimestamp(float(exp), tz=datetime.timezone.utc).strftime("%Y-%m-%d")
            except Exception:
                expiry_date = str(exp)

        remaining_days = _remaining_days(exp) if not is_lifetime else None

        return {
            **base,
            "status": "Active",
            "validation_message": "License is valid and verified against this hardware.",
            "license_type": license_type,
            "activation_date": activation_date,
            "expiry_date": expiry_date if not is_lifetime else "Never (Lifetime)",
            "remaining_days": remaining_days,
            "client_name": payload.get("client_name") or payload.get("sub") or "Licensed User",
            "license_id": payload.get("jti") or payload.get("license_id") or "N/A",
            "is_lifetime": is_lifetime,
        }

    except PMSException as e:
        return {
            **base,
            "status": "Invalid",
            "validation_message": str(e),
            "license_type": None,
            "activation_date": None,
            "expiry_date": None,
            "remaining_days": None,
            "client_name": None,
            "license_id": None,
            "is_lifetime": False,
        }
    except Exception as e:
        return {
            **base,
            "status": "Error",
            "validation_message": f"An unexpected error occurred: {str(e)}",
            "license_type": None,
            "activation_date": None,
            "expiry_date": None,
            "remaining_days": None,
            "client_name": None,
            "license_id": None,
            "is_lifetime": False,
        }


@router.post("/import", summary="Import New or Renewed License File")
async def import_license_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Admin-only: Upload a .lic file directly. 
    Validates it before replacing the active license.
    Creates a backup of the previous license before overwriting.
    """
    if current_user.Role != "Admin":
        raise HTTPException(status_code=403, detail="Only administrators can import a new license.")

    if not file.filename.endswith(".lic"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .lic files are accepted.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Validate BEFORE saving
    try:
        license_data = validate_license(content)
    except PMSException as e:
        raise HTTPException(status_code=400, detail=f"License validation failed: {e.message}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or tampered license file.")

    os.makedirs(LICENSE_DIR, exist_ok=True)

    # Backup existing license if present
    if os.path.exists(ACTIVE_LICENSE_PATH):
        backup_ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(LICENSE_DIR, f"backup_{backup_ts}.lic")
        try:
            with open(ACTIVE_LICENSE_PATH, "rb") as src, open(backup_path, "wb") as dst:
                dst.write(src.read())
        except Exception:
            pass  # Non-fatal

    # Save new license
    with open(ACTIVE_LICENSE_PATH, "wb") as f:
        f.write(content)

    return {
        "success": True,
        "message": "New license imported and activated successfully.",
        "data": license_data
    }


@router.post("/validate", summary="Re-validate Current License")
def revalidate_license():
    """
    Explicitly re-validates the current active license and returns
    a structured validation report.
    """
    if not os.path.exists(ACTIVE_LICENSE_PATH):
        return {
            "valid": False,
            "checks": {
                "file_exists": False,
                "signature_valid": False,
                "hardware_match": False,
                "not_expired": False,
            },
            "message": "No license file found."
        }

    checks = {
        "file_exists": True,
        "signature_valid": False,
        "hardware_match": False,
        "not_expired": False,
    }

    try:
        with open(ACTIVE_LICENSE_PATH, "rb") as f:
            content = f.read()

        payload = validate_license(content)  # Throws on any failure
        checks["signature_valid"] = True
        checks["hardware_match"] = True

        exp = payload.get("exp")
        if exp is None or datetime.datetime.fromtimestamp(float(exp), tz=datetime.timezone.utc) > datetime.datetime.now(datetime.timezone.utc):
            checks["not_expired"] = True

        return {"valid": True, "checks": checks, "message": "License passed all validation checks."}

    except PMSException as e:
        # Determine which check failed
        err_msg = str(e)
        if "hardware" in err_msg.lower() or "mismatch" in err_msg.lower():
            checks["signature_valid"] = True  # Sig was OK but HW failed
            checks["hardware_match"] = False
        elif "expired" in err_msg.lower():
            checks["signature_valid"] = True
            checks["hardware_match"] = True
            checks["not_expired"] = False
        return {"valid": False, "checks": checks, "message": err_msg}
    except Exception as e:
        return {"valid": False, "checks": checks, "message": f"Validation error: {str(e)}"}
