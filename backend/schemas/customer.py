from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class CustomerBase(BaseModel):
    Name: str
    Phone: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
    Address: Optional[str] = None
    LoyaltyPoints: int = 0
    DueBalance: Optional[float] = 0.0
    IsActive: bool = True

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    Name: Optional[str] = None
    Phone: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
    Address: Optional[str] = None
    LoyaltyPoints: Optional[int] = None
    DueBalance: Optional[float] = None
    IsActive: Optional[bool] = None

class CustomerResponse(CustomerBase):
    CustomerId: int

    model_config = ConfigDict(from_attributes=True)
