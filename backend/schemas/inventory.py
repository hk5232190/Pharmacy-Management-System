from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class StockAdjustmentCreate(BaseModel):
    BatchId: int
    AdjustmentType: str = Field(..., pattern="^(Increase|Decrease)$")
    Quantity: int = Field(..., gt=0)
    Reason: str = Field(..., min_length=5)

class StockAdjustmentResponse(BaseModel):
    AdjustmentId: int
    BatchId: int
    MedicineName: str
    BatchCode: str
    AdjustmentType: str
    Quantity: int
    Reason: str
    AdjustmentDate: datetime
    UserName: str

    class Config:
        from_attributes = True

class StockMovementResponse(BaseModel):
    Date: datetime
    MedicineName: str
    BatchCode: str
    Barcode: Optional[str] = None
    MovementType: str
    QuantityChange: int
    BalanceStock: int
    Reference: str
    SourceId: Optional[int] = None

class AuditLogResponse(BaseModel):
    LogId: int
    Timestamp: datetime
    Action: str
    Description: str
    UserName: str

    class Config:
        from_attributes = True

class ExpiryKpiSummary(BaseModel):
    expired_count: int
    expired_value: float
    expiring_30d_count: int
    expiring_30d_value: float
    expiring_90d_count: int
    expiring_90d_value: float

class ExpiryItem(BaseModel):
    BatchId: int
    MedicineName: str
    CategoryName: str
    SupplierName: str
    BatchCode: str
    CurrentStock: int
    PurchasePrice: float
    ValueAtRisk: float
    ExpiryDate: datetime
    DaysToExpiry: int
    ExpiryStatus: str

class ExpiryPagedResponse(BaseModel):
    items: List[ExpiryItem]
    total: int
    page: int
    page_size: int
    kpi_summary: ExpiryKpiSummary

