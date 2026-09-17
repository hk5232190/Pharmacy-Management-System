import json
from typing import Generator, Callable
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from database import SessionLocal
from models import User
from core.exceptions import AuthenticationError
from core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid authentication credentials")
    
    user = db.query(User).filter(User.UserId == int(user_id)).first()
    if not user:
        raise AuthenticationError("User not found")
    if not user.IsActive:
        raise AuthenticationError("Inactive user")
    return user

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure this user has admin rights."""
    if getattr(current_user, "Role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_permission(module: str) -> Callable:
    """
    Dependency factory — returns a FastAPI dependency that enforces module-level access.

    Usage:
        router = APIRouter(dependencies=[Depends(require_permission("purchases"))])
    
    - Admins always pass.
    - Cashiers pass only if `module` is in their Permissions JSON column.
    - Anyone else gets HTTP 403.
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        role = getattr(current_user, "Role", "admin")
        if role == "admin":
            return current_user  # admins bypass all permission checks

        # Parse the stored permissions
        try:
            from schemas.users import DEFAULT_CASHIER_PERMISSIONS
            perms = json.loads(current_user.Permissions or "[]")
            if not isinstance(perms, list):
                perms = DEFAULT_CASHIER_PERMISSIONS
        except (json.JSONDecodeError, TypeError):
            from schemas.users import DEFAULT_CASHIER_PERMISSIONS
            perms = DEFAULT_CASHIER_PERMISSIONS

        if module not in perms:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: your account does not have permission to access the '{module}' module."
            )
        return current_user

    return _check
