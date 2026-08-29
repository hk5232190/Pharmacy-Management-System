from typing import Generator
from fastapi import Depends
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
    # Future-proof: Ensure this user has admin rights. 
    # Currently, any active user acts as an admin.
    return current_user
