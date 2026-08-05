from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Common Sub-Models
class SalesTransaction(BaseModel):
    InvoiceNo: str
    TransactionDate: datetime
    CustomerName: str
    MedicinesSold: int
    TotalQty: int
    Discount: float
    Tax: float
    GrandTotal: float
    PaymentMethod: str
    Status: str

class SalesTrendPoint(BaseModel):
    label: str
    sales: float
    profit: float

class PaymentMethodStats(BaseModel):
    name: str
    value: float

class TopMedicineStats(BaseModel):
    name: str
    quantity: int
    revenue: float

class PurchaseTransaction(BaseModel):
    InvoiceNo: str
    PurchaseDate: datetime
    SupplierName: str
    MedicinesPurchased: int
    TotalQty: int
    Discount: float
    Tax: float
    GrandTotal: float
    Status: str

class PurchaseTrendPoint(BaseModel):
    label: str
    purchases: float

class SupplierStats(BaseModel):
    name: str
    value: float

class TopPurchasedMedicineStats(BaseModel):
    name: str
    quantity: int
    cost: float

# Response Models
class SalesReportSummary(BaseModel):
    TotalGrossSales: float
    TotalReturns: float
    NetSales: float
    TotalCOGS: float
    NetProfit: float
    ProfitMarginPercent: float
    TotalInvoices: int
    AverageSale: float
    HighestSale: float

class SalesReportResponse(BaseModel):
    summary: SalesReportSummary
    trend_data: List[SalesTrendPoint]
    payment_methods: List[PaymentMethodStats]
    top_medicines: List[TopMedicineStats]
    transactions: List[SalesTransaction]

class PurchaseReportSummary(BaseModel):
    TotalGrossPurchases: float
    TotalReturns: float
    NetPurchases: float
    TotalInvoices: int
    AveragePurchase: float
    HighestPurchase: float

class PurchaseReportResponse(BaseModel):
    summary: PurchaseReportSummary
    trend_data: List[PurchaseTrendPoint]
    suppliers: List[SupplierStats]
    top_medicines: List[TopPurchasedMedicineStats]
    transactions: List[PurchaseTransaction]
