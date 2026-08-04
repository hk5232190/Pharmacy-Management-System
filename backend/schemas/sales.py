from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class SaleInitResponse(BaseModel):
    InvoiceNumber: str
    DefaultTaxRate: float

class ProductSearchBatch(BaseModel):
    BatchId: int
    BatchCode: str
    ExpiryDate: date
    AvailableStock: int
    UnitPrice: float

class ProductSearchResponse(BaseModel):
    MedicineId: int
    MedicineName: str
    GenericName: str
    RequiresPrescription: bool
    Batches: List[ProductSearchBatch]

class SaleItemCreate(BaseModel):
    MedicineId: int
    BatchId: int
    Quantity: int
    UnitPrice: float
    Discount: float
    TaxPercent: float
    LineTotal: float
    RequiresPrescription: bool

class SaleCreate(BaseModel):
    CustomerId: Optional[int] = None
    SubTotal: float
    DiscountAmount: float
    TaxAmount: float
    GrandTotal: float
    PaidAmount: float
    PaymentMethod: str
    PrescriptionRef: Optional[str] = None
    Items: List[SaleItemCreate]

class InvoiceSearchItem(BaseModel):
    SalesItemId: int
    BatchId: int
    MedicineName: str
    BatchCode: str
    Quantity: int
    ReturnedQuantity: int
    UnitPrice: float
    Discount: float
    Tax: float
    TotalPrice: float

class InvoiceSearchResponse(BaseModel):
    SalesId: int
    InvoiceNumber: str
    TransactionDate: str
    CustomerName: str
    Items: List[InvoiceSearchItem]
    SubTotal: float
    DiscountAmount: float
    GrandTotal: float

class SaleReturnItemCreate(BaseModel):
    SalesItemId: int
    BatchId: int
    ReturnQuantity: int
    ItemCondition: str

class SaleReturnCreate(BaseModel):
    InvoiceNumber: str
    Reason: str
    Items: List[SaleReturnItemCreate]

class SaleHistoryItem(BaseModel):
    SalesId: int
    InvoiceNumber: str
    TransactionDate: str
    CustomerName: str
    CashierName: str
    PaymentMethod: str
    GrandTotal: float
    Status: str # "Completed", "Partially Returned", "Fully Refunded"
