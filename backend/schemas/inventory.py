from pydantic import BaseModel, Field
from typing import Optional
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
    MovementType: str
    QuantityChange: int
    Reference: str
    UserName: str

class AuditLogResponse(BaseModel):
    LogId: int
    Timestamp: datetime
    Action: str
    Description: str
    UserName: str

    class Config:
        from_attributes = True
