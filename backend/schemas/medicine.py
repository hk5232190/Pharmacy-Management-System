from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from decimal import Decimal

class MedicineBase(BaseModel):
    BrandName: str
    GenericName: str
    CategoryId: int
    CompanyId: int
    RackNumber: Optional[str] = None
    ReorderLevel: int = 10
    RequiresPrescription: bool = False
    Unit: str = "Box"
    Barcode: Optional[str] = None
    DefaultCostPrice: Decimal = Field(default=0, ge=0)
    DefaultSellingPrice: Decimal = Field(default=0, ge=0)
    IsActive: bool = True

class MedicineCreate(MedicineBase):
    pass

class MedicineUpdate(BaseModel):
    BrandName: Optional[str] = None
    GenericName: Optional[str] = None
    CategoryId: Optional[int] = None
    CompanyId: Optional[int] = None
    RackNumber: Optional[str] = None
    ReorderLevel: Optional[int] = None
    RequiresPrescription: Optional[bool] = None
    Unit: Optional[str] = None
    Barcode: Optional[str] = None
    DefaultCostPrice: Optional[Decimal] = None
    DefaultSellingPrice: Optional[Decimal] = None
    IsActive: Optional[bool] = None

class MedicineResponse(MedicineBase):
    MedicineId: int
    
    # Optional fields for joining data in the response
    CategoryName: Optional[str] = None
    CompanyName: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
