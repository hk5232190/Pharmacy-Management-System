from datetime import timedelta
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os
import pathlib

from api.deps import get_db, get_current_user
from models import User, SecuritySettings
from core.security import verify_password, create_access_token, get_password_hash_and_salt
from core.exceptions import AuthenticationError, ValidationError
from core.logger import logger

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
    email: Optional[str] = None
    is_active: bool
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_photo_path: Optional[str] = None

class UserProfileUpdate(BaseModel):
    FullName: Optional[str] = None
    Email: Optional[str] = None
    PhoneNumber: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class VerifyPinRequest(BaseModel):
    pin: str

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

    # Set expiry duration based on remember me and security settings
    if remember_me:
        access_token_expires = timedelta(days=REMEMBER_ME_EXPIRE_DAYS)
    else:
        # Fetch dynamic session timeout from SecuritySettings
        sec_settings = db.query(SecuritySettings).first()
        if sec_settings and sec_settings.SessionTimeoutEnabled:
            access_token_expires = timedelta(minutes=sec_settings.SessionTimeoutMinutes)
        else:
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    access_token = create_access_token(
        data={"sub": str(user.UserId)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token, summary="Refresh Access Token")
def refresh_access_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch dynamic session timeout from SecuritySettings
    sec_settings = db.query(SecuritySettings).first()
    if sec_settings and sec_settings.SessionTimeoutEnabled:
        access_token_expires = timedelta(minutes=sec_settings.SessionTimeoutMinutes)
    else:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    access_token = create_access_token(
        data={"sub": str(current_user.UserId)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserProfile, summary="Get Current User Profile")
def read_users_me(current_user: User = Depends(get_current_user)):
    return UserProfile(
        id=current_user.UserId,
        username=current_user.Username,
        email=current_user.Email,
        is_active=current_user.IsActive,
        full_name=current_user.FullName,
        phone_number=current_user.PhoneNumber,
        profile_photo_path=current_user.ProfilePhotoPath
    )

@router.put("/me", summary="Update Current User Profile")
def update_user_profile(
    profile_data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.FullName = profile_data.FullName
    current_user.Email = profile_data.Email
    current_user.PhoneNumber = profile_data.PhoneNumber
    db.commit()
    
    logger.info(f"AUDIT: User {current_user.Username} updated their profile information.")
    return {"message": "Profile updated successfully"}

from fastapi import UploadFile, File, HTTPException
@router.post("/me/photo", summary="Upload Profile Photo")
def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WEBP are allowed.")
    
    file.file.seek(0, 2)
    file_size = file.file.tell()
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit.")
    file.file.seek(0)

    # Cleanup old photo
    if current_user.ProfilePhotoPath:
        old_path = os.path.join(".", current_user.ProfilePhotoPath.lstrip("/"))
        if os.path.exists(old_path):
            try:
                os.unlink(old_path)
            except Exception as e:
                logger.error(f"Failed to delete old profile photo: {e}")

    file_extension = file.filename.split(".")[-1]
    filename = f"user_{current_user.UserId}.{file_extension}"
    file_path = f"uploads/profile/{filename}"

    with open(file_path, "wb") as buffer:
        import shutil
        shutil.copyfileobj(file.file, buffer)

    current_user.ProfilePhotoPath = f"/{file_path}"
    db.commit()
    db.refresh(current_user)
    
    logger.info(f"AUDIT: User {current_user.Username} uploaded a new Profile Photo.")
    return {"message": "Profile photo uploaded successfully", "photo_path": current_user.ProfilePhotoPath}

@router.delete("/me/photo", summary="Remove Profile Photo")
def remove_profile_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.ProfilePhotoPath:
        old_path = os.path.join(".", current_user.ProfilePhotoPath.lstrip("/"))
        if os.path.exists(old_path):
            try:
                os.unlink(old_path)
            except Exception as e:
                logger.error(f"Failed to delete old profile photo: {e}")
                
        current_user.ProfilePhotoPath = None
        db.commit()
        
        logger.info(f"AUDIT: User {current_user.Username} removed their Profile Photo.")
        
    return {"message": "Profile photo removed successfully"}

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

@router.post("/verify-pin", summary="Verify Admin PIN / Password for Operations")
def verify_admin_pin(
    request: VerifyPinRequest,
    current_user: User = Depends(get_current_user)
):
    if not verify_password(request.pin, current_user.PasswordHash, current_user.Salt):
        raise AuthenticationError("Incorrect PIN/Password")
    return {"success": True, "message": "Authorized"}

@router.post("/logout", summary="Logout")
def logout():
    # Since we use stateless JWTs, the client simply drops the token. 
    # We return success for consistency.
    return {"status": "ok", "message": "Successfully logged out"}
