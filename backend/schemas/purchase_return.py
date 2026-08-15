from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PurchaseReturnItemCreate(BaseModel):
    MedicineId: int
    BatchCode: str = Field(..., min_length=1)
    ReturnQuantity: int = Field(..., gt=0)
    RefundAmount: float = Field(..., ge=0)
    ReturnReason: Optional[str] = None

class PurchaseReturnCreate(BaseModel):
    PurchaseId: int
    SupplierId: int
    ReturnInvoiceNumber: str = Field(..., min_length=1)
    TotalRefundAmount: float = Field(..., ge=0)
    Reason: Optional[str] = None
    SettlementType: str = "Adjust in Supplier Balance"
    items: List[PurchaseReturnItemCreate] = Field(..., min_items=1)

class PurchaseReturnItemResponse(BaseModel):
    ReturnItemId: int
    ReturnId: int
    MedicineId: int
    BatchCode: str
    ReturnQuantity: int
    RefundAmount: float
    ReturnReason: Optional[str] = None
    
    MedicineName: Optional[str] = None

    class Config:
        from_attributes = True

class PurchaseReturnResponse(BaseModel):
    ReturnId: int
    PurchaseId: int
    SupplierId: int
    ReturnInvoiceNumber: str
    ReturnDate: datetime
    TotalRefundAmount: float
    Reason: Optional[str] = None
    SettlementType: Optional[str] = None
    
    items: List[PurchaseReturnItemResponse]
    SupplierName: Optional[str] = None
    OriginalInvoiceNumber: Optional[str] = None

    class Config:
        from_attributes = True
