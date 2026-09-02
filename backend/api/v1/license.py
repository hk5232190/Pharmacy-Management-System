from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import os
import json
import stat
import datetime
from utils.hwid import get_primary_mac
from utils.license_engine import validate_license
from core.exceptions import PMSException
from api.deps import get_current_user, get_current_admin_user
from database import SessionLocal
from sqlalchemy.orm import Session
import models

router = APIRouter()

LICENSE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "licenses")
ACTIVE_LICENSE_PATH = os.path.join(LICENSE_DIR, "active.lic")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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

@router.get("/mac", summary="Get MAC Address (for license binding)")
def get_mac_address():
    """Returns the physical MAC address of this machine used for license binding."""
    mac = get_primary_mac()
    return {"mac": mac}


@router.get("/hwid", summary="Get MAC Address (backward-compat alias)")
def get_hardware_id_alias():
    """
    Backward-compatible alias — now returns MAC address.
    Use GET /mac for new integrations.
    """
    mac = get_primary_mac()
    return {"hwid": mac, "mac": mac}


@router.get("/hardware-id", summary="Get MAC Address (Canonical)")
def get_hardware_fingerprint():
    """
    Returns the MAC address used for license binding on this machine.
    """
    mac = get_primary_mac()
    return {
        "mac_address": mac,
        "generated_from": "Physical network adapter MAC address",
    }


from pydantic import BaseModel


class LicenseActivationRequest(BaseModel):
    license_key: str


@router.post("/activate", summary="Activate License via File Upload")
async def activate_license(file: UploadFile = File(...)):
    """Accepts a .lic file, validates it, and saves as active license."""
    if not file.filename.endswith(".lic"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .lic files are allowed.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The license file is empty.")

        payload = validate_license(content)
        os.makedirs(LICENSE_DIR, exist_ok=True)
        with open(ACTIVE_LICENSE_PATH, "wb") as f:
            f.write(content)
            
        client_name = payload.get("client_name") or payload.get("sub") or "N/A"
        license_type = payload.get("type", "Unknown")
        exp = payload.get("exp")
        
        import datetime
        if exp and license_type != "Lifetime":
            try:
                expiry_date = datetime.datetime.fromtimestamp(float(exp), tz=datetime.timezone.utc).isoformat()
            except Exception:
                expiry_date = str(exp)
        else:
            expiry_date = None

        formatted_data = {
            "client_name": client_name,
            "license_type": license_type,
            "expiry_date": expiry_date,
        }
            
        return {"status": "success", "message": "License activated successfully", "data": formatted_data}
    except PMSException as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to process license file")


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
def get_license_info(db: Session = Depends(get_db)):
    """
    Returns the complete license dashboard data:
    status, type, activation date, expiry date, remaining days,
    hardware ID (included directly to avoid extra round-trips),
    masked key reference, pharmacy name, total_days for progress bar,
    file metadata, and validation details.

    Key reference is always masked server-side for security.
    Use GET /key-reference (authenticated) to obtain the full value.
    """
    mac = get_primary_mac()

    # ── Pharmacy name from DB (Client / Licensee binding) ────────────────────
    pharmacy_name: str | None = None
    try:
        profile = db.query(models.PharmacyProfile).first()
        if profile and profile.PharmacyName:
            pharmacy_name = profile.PharmacyName
    except Exception:
        pass  # Non-fatal; fall back to license payload value

    base = {
        "mac_address": mac,
        "license_file_info": _file_info(ACTIVE_LICENSE_PATH) if os.path.exists(ACTIVE_LICENSE_PATH) else {},
        # Masked key — full value never transmitted in standard status payload
        "key_reference": _key_reference(ACTIVE_LICENSE_PATH) if os.path.exists(ACTIVE_LICENSE_PATH) else "N/A",
        "pharmacy_name": pharmacy_name,
        "total_days": None,
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

        # ── total_days: span from activation to expiry (for progress bar) ────
        total_days: int | None = None
        if not is_lifetime and iat and exp:
            try:
                iat_dt = datetime.datetime.fromtimestamp(float(iat), tz=datetime.timezone.utc)
                exp_dt = datetime.datetime.fromtimestamp(float(exp), tz=datetime.timezone.utc)
                span = (exp_dt - iat_dt).days
                total_days = max(1, span)  # Guard: always at least 1
            except Exception:
                total_days = None

        client_name = payload.get("client_name") or payload.get("sub") or "Licensed User"

        return {
            **base,
            "total_days": total_days,
            "pharmacy_name": pharmacy_name or client_name,
            "status": "Active",
            "validation_message": "License is valid and verified against this machine's MAC address.",
            "license_type": license_type,
            "activation_date": activation_date,
            "expiry_date": expiry_date if not is_lifetime else "Never (Lifetime)",
            "remaining_days": remaining_days,
            "client_name": client_name,
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


@router.get("/key-reference", summary="Reveal Full Key Reference (Authenticated)")
def get_key_reference(
    current_user: models.User = Depends(get_current_user)
):
    """
    Authenticated endpoint: returns the full (unmasked) key reference string
    from the active license file. Requires a valid bearer token.
    This is intentionally separate from /info to protect licensing secrets.
    """
    if not os.path.exists(ACTIVE_LICENSE_PATH):
        raise HTTPException(status_code=404, detail="No active license file found.")
    try:
        with open(ACTIVE_LICENSE_PATH, "rb") as f:
            raw = f.read().decode("utf-8", errors="ignore").strip()
        return {"key_reference": raw}
    except Exception:
        raise HTTPException(status_code=500, detail="Could not read license file.")


@router.post("/import", summary="Import New or Renewed License File")
async def import_license_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_admin_user)
):
    """
    Admin-only: Upload a .lic file directly. 
    Validates it before replacing the active license.
    Creates a backup of the previous license before overwriting.
    """

    if not file.filename.endswith(".lic"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .lic files are accepted.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Validate BEFORE saving
    try:
        license_data = validate_license(content)
        # Check expiration specifically for import
        exp = license_data.get("exp")
        if exp is not None:
            exp_dt = datetime.datetime.fromtimestamp(float(exp), tz=datetime.timezone.utc)
            if exp_dt <= datetime.datetime.now(datetime.timezone.utc):
                raise HTTPException(status_code=400, detail="Cannot import an expired license.")
    except PMSException as e:
        raise HTTPException(status_code=400, detail=f"License validation failed: {e.message}")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or tampered license file.")

    os.makedirs(LICENSE_DIR, exist_ok=True)

    # Backup existing license if present
    if os.path.exists(ACTIVE_LICENSE_PATH):
        backup_path = os.path.join(LICENSE_DIR, "backup_active.lic")
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
            "file_exists": False,
            "signature_valid": False,
            "hardware_match": False,
            "not_expired": False,
            "overall_status": "FAILED",
            "error_message": "No license file found."
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

        return {
            **checks,
            "overall_status": "PASSED",
            "error_message": None
        }

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
        return {
            **checks,
            "overall_status": "FAILED",
            "error_message": err_msg
        }
    except Exception as e:
        return {
            **checks,
            "overall_status": "FAILED",
            "error_message": f"Validation error: {str(e)}"
        }
