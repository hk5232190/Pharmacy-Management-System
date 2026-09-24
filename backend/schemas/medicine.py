from pydantic import BaseModel, ConfigDict, Field, validator, model_validator
from typing import Optional, List
from decimal import Decimal
from datetime import date


class InitialStockBatch(BaseModel):
    """One batch of initial stock to be created atomically with the medicine."""
    BatchCode: str = Field(..., min_length=1, max_length=50)
    Quantity: int = Field(..., gt=0, description="Positive integer, same unit as Purchase/POS")
    CostPrice: Decimal = Field(..., ge=Decimal("0"))
    SellingPrice: Decimal = Field(..., ge=Decimal("0"))
    ExpiryDate: date
    ManufacturingDate: Optional[date] = None

    @validator("BatchCode")
    def normalize_batch_code(cls, v: str) -> str:
        normalized = v.strip().upper()
        if not normalized:
            raise ValueError("Batch Number cannot be blank or whitespace only")
        return normalized

    @model_validator(mode='after')
    def mfg_before_expiry(self):
        mfg = self.ManufacturingDate
        exp = self.ExpiryDate
        if mfg and exp and mfg > exp:
            raise ValueError(
                f"Manufacturing Date ({mfg}) must be on or before Expiry Date ({exp})"
            )
        return self


class MedicineBase(BaseModel):
    BrandName: str
    GenericName: str
    CategoryId: int
    CompanyId: int
    RackNumber: Optional[str] = None
    ReorderLevel: int = 10
    RequiresPrescription: bool = False
    Unit: str = "Box"
    DosageForm: Optional[str] = None
    Strength: Optional[str] = None
    Barcode: Optional[str] = None
    DefaultCostPrice: Decimal = Field(default=0, ge=0)
    DefaultSellingPrice: Decimal = Field(default=0, ge=0)
    IsActive: bool = True


class MedicineCreate(MedicineBase):
    """
    Create medicine with optional initial stock batches (committed atomically).

    ExistingMedicineId — set by the import preview endpoint when a medicine with
    the same BrandName already exists. The bulk-import endpoint will skip medicine
    creation and only add the supplied initial_stock batches to the existing record.
    """
    initial_stock: Optional[List[InitialStockBatch]] = None
    ExistingMedicineId: Optional[int] = None  # import-only field


class MedicineUpdate(BaseModel):
    BrandName: Optional[str] = None
    GenericName: Optional[str] = None
    CategoryId: Optional[int] = None
    CompanyId: Optional[int] = None
    RackNumber: Optional[str] = None
    ReorderLevel: Optional[int] = None
    RequiresPrescription: Optional[bool] = None
    Unit: Optional[str] = None
    DosageForm: Optional[str] = None
    Strength: Optional[str] = None
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
