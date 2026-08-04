from datetime import timedelta
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from api.deps import get_db, get_current_user
from models import User
from core.security import verify_password, create_access_token, get_password_hash_and_salt
from core.exceptions import AuthenticationError, ValidationError

router = APIRouter()

# 2 hours default, 30 days for remember me
ACCESS_TOKEN_EXPIRE_MINUTES = 120
REMEMBER_ME_EXPIRE_DAYS = 30

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    id: int
    username: str
    is_active: bool

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/login", response_model=Token, summary="Login for Access Token")
def login_for_access_token(
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = False
):
    user = db.query(User).filter(User.Username == form_data.username).first()
    if not user:
        raise AuthenticationError("Incorrect username or password")
    
    if not verify_password(form_data.password, user.PasswordHash, user.Salt):
        raise AuthenticationError("Incorrect username or password")
        
    if not user.IsActive:
        raise AuthenticationError("Inactive user")

    # Set expiry duration based on remember me
    if remember_me:
        access_token_expires = timedelta(days=REMEMBER_ME_EXPIRE_DAYS)
    else:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    access_token = create_access_token(
        data={"sub": str(user.UserId)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserProfile, summary="Get Current User Profile")
def read_users_me(current_user: User = Depends(get_current_user)):
    return UserProfile(
        id=current_user.UserId,
        username=current_user.Username,
        is_active=current_user.IsActive
    )

@router.post("/change-password", summary="Change Password")
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(request.current_password, current_user.PasswordHash, current_user.Salt):
        raise ValidationError("Incorrect current password")
        
    hash_str, salt_str = get_password_hash_and_salt(request.new_password)
    current_user.PasswordHash = hash_str
    current_user.Salt = salt_str
    
    db.commit()
    return {"status": "ok", "message": "Password changed successfully"}

@router.post("/logout", summary="Logout")
def logout():
    # Since we use stateless JWTs, the client simply drops the token. 
    # We return success for consistency.
    return {"status": "ok", "message": "Successfully logged out"}
