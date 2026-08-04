import jwt
import os
import datetime
from cryptography.hazmat.primitives import serialization
from core.exceptions import LicenseExpiredError, HardwareMismatchError, TamperedLicenseError
from utils.hwid import generate_hwid
from core.logger import logger

KEYS_DIR = os.path.join(os.path.dirname(__file__), "keys")
PUBLIC_KEY_PATH = os.path.join(KEYS_DIR, "public.pem")
PRIVATE_KEY_PATH = os.path.join(KEYS_DIR, "private.pem")

def get_public_key():
    if not os.path.exists(PUBLIC_KEY_PATH):
        raise FileNotFoundError("Public key not found. Please ensure the app is correctly built.")
    with open(PUBLIC_KEY_PATH, "rb") as f:
        return serialization.load_pem_public_key(f.read())

def get_private_key():
    if not os.path.exists(PRIVATE_KEY_PATH):
        raise FileNotFoundError("Private key not found. This should only be used by the vendor.")
    with open(PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def validate_license(token: str) -> dict:
    """
    Validates a license token (JWT).
    Throws TamperedLicenseError, LicenseExpiredError, or HardwareMismatchError.
    Returns license data if valid.
    """
    try:
        public_key = get_public_key()
        
        # Decode the token and verify the signature using the public RSA key
        # jwt.decode automatically verifies expiry (exp) if present, throwing ExpiredSignatureError
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"]
        )
        
        # Verify Hardware ID
        machine_hwid = generate_hwid()
        if payload.get("hwid") != machine_hwid:
            logger.warning(f"Hardware mismatch. License HWID: {payload.get('hwid')}, Machine HWID: {machine_hwid}")
            raise HardwareMismatchError()
            
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("License token has expired.")
        raise LicenseExpiredError()
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid or tampered license token: {e}")
        raise TamperedLicenseError()
    except HardwareMismatchError:
        raise
    except Exception as e:
        logger.error(f"License validation failed unexpectedly: {e}")
        raise TamperedLicenseError()

def generate_test_license(hwid: str, license_type: str = "Subscription", days_valid: int = 365, start_date: datetime.datetime = None, end_date: datetime.datetime = None) -> str:
    """
    Generates a test license .lic file for local development.
    Uses the private key which would normally be kept secret by the vendor.
    """
    private_key = get_private_key()
    
    iat = start_date if start_date else datetime.datetime.now(datetime.timezone.utc)
    
    payload = {
        "hwid": hwid,
        "type": license_type,
        "iat": iat,
    }
    
    if license_type != "Lifetime":
        if end_date:
            payload["exp"] = end_date
        else:
            payload["exp"] = iat + datetime.timedelta(days=days_valid)
        
    token = jwt.encode(payload, private_key, algorithm="RS256")
    return token
