from pydantic import BaseModel, ConfigDict
from typing import Optional

class CustomerBase(BaseModel):
    Name: str
    Phone: Optional[str] = None
    LoyaltyPoints: int = 0
    IsActive: bool = True

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    Name: Optional[str] = None
    Phone: Optional[str] = None
    LoyaltyPoints: Optional[int] = None
    IsActive: Optional[bool] = None

class CustomerResponse(CustomerBase):
    CustomerId: int

    model_config = ConfigDict(from_attributes=True)
