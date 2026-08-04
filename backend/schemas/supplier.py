from pydantic import BaseModel, ConfigDict
from typing import Optional

class SupplierBase(BaseModel):
    Name: str
    Phone: str
    TaxNumber: Optional[str] = None
    Address: Optional[str] = None
    IsActive: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    Name: Optional[str] = None
    Phone: Optional[str] = None
    TaxNumber: Optional[str] = None
    Address: Optional[str] = None
    IsActive: Optional[bool] = None

class SupplierResponse(SupplierBase):
    SupplierId: int

    model_config = ConfigDict(from_attributes=True)
