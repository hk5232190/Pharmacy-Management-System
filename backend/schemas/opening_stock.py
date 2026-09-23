"""Opening Stock Pydantic schemas.

All financial fields use Decimal for precision.
BatchCode is normalized (strip + upper) via validator.
ManufacturingDate <= ExpiryDate is enforced.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from pydantic import BaseModel, Field, validator, model_validator


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def normalize_batch_code(code: str) -> str:
    """Strip whitespace and uppercase for consistent duplicate detection."""
    return code.strip().upper()


def compute_payload_hash(items: "List[OpeningStockLineItem]") -> str:
    """
    SHA-256 of the canonicalized payload.
    Includes all 7 material fields; sorted by (MedicineId, BatchCode).
    This prevents duplicate imports regardless of file name.
    """
    canonical = sorted(
        [
            {
                "MedicineId": item.MedicineId,
                "BatchCode": normalize_batch_code(item.BatchCode),
                "Quantity": item.Quantity,
                "CostPrice": str(item.CostPrice),
                "SellingPrice": str(item.SellingPrice),
                "ExpiryDate": str(item.ExpiryDate),
                "ManufacturingDate": str(item.ManufacturingDate) if item.ManufacturingDate else None,
            }
            for item in items
        ],
        key=lambda x: (x["MedicineId"], x["BatchCode"]),
    )
    return hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest()


# ──────────────────────────────────────────────────────────────────────────────
# Input schemas
# ──────────────────────────────────────────────────────────────────────────────

class OpeningStockLineItem(BaseModel):
    MedicineId: int = Field(..., gt=0, description="Must reference an existing active Medicine")
    BatchCode: str = Field(..., min_length=1, max_length=50)
    # Quantity uses the SAME integer unit as StockBatch/PurchaseItem/SaleItem — no new unit system.
    Quantity: int = Field(..., gt=0, description="Positive integer, same unit as Purchase/POS")
    CostPrice: Decimal = Field(..., ge=Decimal("0"))
    SellingPrice: Decimal = Field(..., ge=Decimal("0"))
    ExpiryDate: date
    ManufacturingDate: Optional[date] = None

    @validator("BatchCode")
    def normalize_and_require_batch(cls, v: str) -> str:
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


class OpeningStockCreate(BaseModel):
    Notes: Optional[str] = None
    # idempotency_token returned by /preview — must match the hash server computes
    idempotency_token: str = Field(..., description="Token from /preview endpoint")
    items: List[OpeningStockLineItem] = Field(..., min_items=1)


class OpeningStockPreviewRequest(BaseModel):
    items: List[OpeningStockLineItem] = Field(..., min_items=1)


# ──────────────────────────────────────────────────────────────────────────────
# Response schemas
# ──────────────────────────────────────────────────────────────────────────────

class OpeningStockPreviewItem(BaseModel):
    MedicineId: int
    MedicineName: str
    BatchCode: str                       # normalized form
    Quantity: int
    CostPrice: Decimal
    SellingPrice: Decimal
    ExpiryDate: date
    ManufacturingDate: Optional[date] = None
    Error: Optional[str] = None          # hard-block reason (batch exists, unknown med, etc.)
    Warning: Optional[str] = None        # soft warning (informational only)


class OpeningStockPreviewResponse(BaseModel):
    idempotency_token: str
    items: List[OpeningStockPreviewItem]
    has_errors: bool
    total_items: int
    total_value: Decimal


class OpeningStockItemResponse(BaseModel):
    ItemId: int
    MedicineId: int
    MedicineName: str
    BatchCode: str
    BatchId: int
    Quantity: int
    CostPrice: Decimal
    SellingPrice: Decimal
    ExpiryDate: date
    ManufacturingDate: Optional[date] = None

    class Config:
        from_attributes = True


class OpeningStockEntryResponse(BaseModel):
    EntryId: int
    ReferenceNo: str
    Notes: Optional[str] = None
    EntryDate: datetime
    CreatedByName: str
    TotalItems: int
    TotalQuantity: int = 0
    TotalValue: Decimal
    ImportFile: Optional[str] = None
    Status: str
    VoidedAt: Optional[datetime] = None
    VoidedByName: Optional[str] = None
    items: Optional[List[OpeningStockItemResponse]] = None

    class Config:
        from_attributes = True


class OpeningStockEntrySummary(BaseModel):
    """Lightweight summary for listing page."""
    EntryId: int
    ReferenceNo: str
    EntryDate: datetime
    CreatedByName: str
    TotalItems: int
    TotalQuantity: int = 0
    TotalValue: Decimal
    ImportFile: Optional[str] = None
    Status: str
    Medicines: List[str] = []
    BatchCodes: List[str] = []

    class Config:
        from_attributes = True
