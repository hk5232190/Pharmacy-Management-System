from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import date, datetime, timedelta

class PurchaseItemCreate(BaseModel):
    MedicineId: int
    BatchCode: str = Field(..., min_length=1)
    Quantity: int = Field(..., gt=0)
    FreeQty: int = 0
    CostPrice: float = Field(..., ge=0)
    SellingPrice: float = Field(..., gt=0)
    Discount: float = 0
    TaxPercentage: float = 0
    LineTotal: float = Field(..., ge=0)
    ManufacturingDate: Optional[date] = None
    ExpiryDate: date

    @field_validator('ExpiryDate')
    @classmethod
    def validate_expiry(cls, v):
        min_expiry = date.today() + timedelta(days=30)
        if v <= min_expiry:
            raise ValueError(f"Expiry date must be greater than current date + 30 days (min {min_expiry})")
        return v

    @field_validator('SellingPrice')
    @classmethod
    def validate_selling_price(cls, v, info):
        # We check selling price against cost price since info.data contains previously validated fields (like CostPrice)
        cost_price = info.data.get('CostPrice')
        if cost_price is not None and cost_price > v:
            raise ValueError(f"Purchase cost price ({cost_price}) cannot exceed selling price (MRP) ({v})")
        return v

class PurchaseCreate(BaseModel):
    SupplierId: int
    InvoiceNumber: str = Field(..., min_length=1)
    SupplierInvNo: Optional[str] = None
    PaymentStatus: str = "Unpaid"
    PaymentMethod: Optional[str] = None
    Notes: Optional[str] = None
    
    SubTotal: float = Field(..., ge=0)
    TotalDiscount: float = 0
    TotalTax: float = 0
    GrandTotal: float = Field(..., ge=0)
    PaidAmount: float = 0
    RemainingBalance: float = 0
    PurchaseDate: datetime = Field(default_factory=datetime.now)
    
    items: List[PurchaseItemCreate] = Field(..., min_items=1)
    
class PurchaseItemResponse(BaseModel):
    PurchaseItemId: int
    PurchaseId: int
    MedicineId: int
    BatchCode: str
    Quantity: int
    FreeQty: int
    CostPrice: float
    SellingPrice: float
    Discount: float
    TaxPercentage: float
    LineTotal: float
    ManufacturingDate: Optional[date] = None
    ExpiryDate: date
    
    # For UI
    MedicineName: Optional[str] = None

    class Config:
        from_attributes = True

class PurchaseResponse(BaseModel):
    PurchaseId: int
    SupplierId: int
    InvoiceNumber: str
    SupplierInvNo: Optional[str] = None
    PaymentStatus: str
    PaymentMethod: Optional[str] = None
    Notes: Optional[str] = None
    SubTotal: float
    TotalDiscount: float
    TotalTax: float
    GrandTotal: float
    PaidAmount: float
    RemainingBalance: float
    PurchaseDate: datetime
    
    items: List[PurchaseItemResponse]
    SupplierName: Optional[str] = None

    class Config:
        from_attributes = True
