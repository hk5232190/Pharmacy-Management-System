from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

VALID_ROLES = ("admin", "cashier")

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    full_name: Optional[str] = None
    role: str = "cashier"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)

class UserResponse(BaseModel):
    UserId: int
    Username: str
    FullName: Optional[str] = None
    Email: Optional[str] = None
    PhoneNumber: Optional[str] = None
    ProfilePhotoPath: Optional[str] = None
    IsActive: bool
    Role: str
    CreatedAt: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)