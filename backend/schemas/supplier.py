from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class SupplierBase(BaseModel):
    Name: str
    Phone: str = Field(..., pattern=r'^(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8}$')
    TaxNumber: Optional[str] = None
    Address: Optional[str] = None
    ContactPerson: Optional[str] = None
    CurrentBalance: Optional[float] = 0.0
    IsActive: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    Name: Optional[str] = None
    Phone: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
    TaxNumber: Optional[str] = None
    Address: Optional[str] = None
    ContactPerson: Optional[str] = None
    CurrentBalance: Optional[float] = None
    IsActive: Optional[bool] = None

class SupplierResponse(SupplierBase):
    SupplierId: int

    model_config = ConfigDict(from_attributes=True)
