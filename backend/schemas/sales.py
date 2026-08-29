from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class SaleInitResponse(BaseModel):
    InvoiceNumber: str
    DefaultTaxRate: float
    MaxDiscountPercentage: float = 0.0
    DiscountEnabled: bool = False
    RequireAdminPinForDiscount: bool = False
    AdminDiscountThreshold: float = 0.0

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
    CustomerId: Optional[int] = None
    Items: List[InvoiceSearchItem]
    SubTotal: float
    DiscountAmount: float
    GrandTotal: float

class SaleReturnItemCreate(BaseModel):
    SalesItemId: int
    BatchId: int
    ReturnQuantity: int
    ItemCondition: str
    ReturnReason: Optional[str] = None

class SaleReturnCreate(BaseModel):
    InvoiceNumber: str
    Reason: str
    RefundMode: str = "Cash Refund"
    Items: List[SaleReturnItemCreate]

class SaleHistoryItem(BaseModel):
    SalesId: int
    InvoiceNumber: str
    TransactionDate: str
    CustomerName: str
    CashierName: str
    PaymentMethod: str
    GrandTotal: float
    PaidAmount: float
    Status: str

class SaleHistoryPagedResponse(BaseModel):
    items: List[SaleHistoryItem]
    total: int
    page: int
    page_size: int

class SaleReturnHistoryItem(BaseModel):
    ReturnId: int
    ReturnInvoiceNumber: str
    OriginalInvoiceNumber: str
    ReturnDate: str
    CustomerName: str
    TotalRefundAmount: float
    RefundMode: str
    Reason: str

class SaleReturnHistoryPagedResponse(BaseModel):
    items: List[SaleReturnHistoryItem]
    total: int
    page: int
    page_size: int
