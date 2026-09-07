import os
import hashlib
import binascii
import jwt
from datetime import datetime, timedelta, timezone
from core.config import settings

PBKDF2_ITERATIONS = 100000
SALT_BYTES = 16 # 128-bit salt

def get_password_hash_and_salt(password: str) -> tuple[str, str]:
    """
    Generates a cryptographically secure 128-bit random salt,
    hashes the password using PBKDF2 with HMAC-SHA256 (100,000 iterations),
    and returns both the hash and salt as hex strings.
    """
    salt = os.urandom(SALT_BYTES)
    hash_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        PBKDF2_ITERATIONS
    )
    return binascii.hexlify(hash_bytes).decode('ascii'), binascii.hexlify(salt).decode('ascii')

def verify_password(plain_password: str, stored_hash: str, stored_salt: str) -> bool:
    """
    Verifies a plain text password against the stored hash and salt using PBKDF2 HMAC-SHA256.
    """
    salt_bytes = binascii.unhexlify(stored_salt)
    hash_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        plain_password.encode('utf-8'),
        salt_bytes,
        PBKDF2_ITERATIONS
    )
    computed_hash = binascii.hexlify(hash_bytes).decode('ascii')
    return computed_hash == stored_hash

def create_access_token(data: dict, expires_delta: timedelta) -> str:
    """
    Creates a JWT access token for user sessions signed with HS256 symmetric key.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes and verifies a JWT access token using the symmetric key.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
