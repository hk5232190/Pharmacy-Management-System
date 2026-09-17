import json
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime

VALID_ROLES = ("admin", "cashier")

# All modules a cashier can be granted access to.
# "sales" is always on by default and cannot be revoked.
ALL_MODULES = ["sales", "dashboard", "purchases", "inventory", "medicines", "suppliers", "customers", "reports", "settings"]
DEFAULT_CASHIER_PERMISSIONS = ["sales"]

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

class UserPermissionsUpdate(BaseModel):
    """Used by PUT /{user_id}/permissions — admin only."""
    permissions: List[str]

class UserResponse(BaseModel):
    UserId: int
    Username: str
    FullName: Optional[str] = None
    Email: Optional[str] = None
    PhoneNumber: Optional[str] = None
    ProfilePhotoPath: Optional[str] = None
    IsActive: bool
    Role: str
    Permissions: Optional[List[str]] = None
    CreatedAt: Optional[datetime] = None

    @field_validator("Permissions", mode="before")
    @classmethod
    def parse_permissions_json(cls, v):
        """SQLAlchemy stores Permissions as a JSON string in the Text column.
        Pydantic receives a raw str — parse it to a list before validation."""
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else None
            except (json.JSONDecodeError, TypeError):
                return None
        return v  # already None or a list (e.g. from unit tests)

    model_config = ConfigDict(from_attributes=True)