from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class CompanyBase(BaseModel):
    CompanyName: str
    ContactPerson: Optional[str] = None
    Phone: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
    Address: Optional[str] = None
    IsActive: bool = True

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    CompanyName: Optional[str] = None
    ContactPerson: Optional[str] = None
    Phone: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
    Address: Optional[str] = None
    IsActive: Optional[bool] = None

class CompanyResponse(CompanyBase):
    CompanyId: int
    TotalProducts: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
