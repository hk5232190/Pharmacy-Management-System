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

class InventoryReportSummary(BaseModel):
    TotalCostValue: float
    TotalRetailValue: float
    ExpiredWrittenOffValuation: float
    TotalItemsInStock: int
    LowStockCount: int
    OutOfStockCount: int

class InventoryMovementSummary(BaseModel):
    PurchasedQty: int
    SoldQty: int
    ManualAdjustmentsQty: int
    ExpiredWrittenOffQty: int

class MedicineMovementItem(BaseModel):
    MedicineName: str
    StartingStock: int
    PurchasedQty: int
    SoldQty: int
    AdjustedQty: int
    ExpiredQty: int
    ClosingStock: int

class InventoryStockItem(BaseModel):
    MedicineName: str
    Category: str
    BatchCode: str
    Quantity: int
    CostPrice: float
    SellingPrice: float
    TotalCostValue: float
    TotalRetailValue: float
    ExpiryDate: datetime
    Status: str

class StockValueByCategory(BaseModel):
    name: str
    value: float

class InventoryReportResponse(BaseModel):
    summary: InventoryReportSummary
    movement_summary: Optional[InventoryMovementSummary] = None
    stock_items: List[InventoryStockItem]
    movement_items: Optional[List[MedicineMovementItem]] = None
    category_valuation: List[StockValueByCategory]


class MedicineExpiryItem(BaseModel):
    MedicineName: str
    BatchCode: str
    Quantity: int
    ExpiryDate: datetime
    DaysToExpiry: int
    Status: str
    SupplierName: Optional[str] = None

class MedicineLowStockItem(BaseModel):
    MedicineName: str
    Category: str
    CurrentStock: int
    ReorderLevel: int
    Deficit: int
    SuggestedReorderQty: int
    SupplierName: Optional[str] = None

class MedicineMovementAnalyticsItem(BaseModel):
    MedicineName: str
    Category: str
    SoldQuantity: int
    SalesVelocity: float
    Revenue: float
    Classification: str
    SupplierName: Optional[str] = None

class MedicineReportSummary(BaseModel):
    TotalExpiredBatches: int
    ExpiringSoonBatches: int
    LowStockMedicines: int
    FastMovingCount: int
    SlowMovingCount: int
    DeadStockCount: int

class PaginationMetadata(BaseModel):
    total: int
    page: int
    page_size: int

class MedicineReportResponse(BaseModel):
    summary: MedicineReportSummary
    expiry_items: Optional[List[MedicineExpiryItem]] = None
    low_stock_items: Optional[List[MedicineLowStockItem]] = None
    movement_items: Optional[List[MedicineMovementAnalyticsItem]] = None
    pagination: Optional[PaginationMetadata] = None

# Financial Reports Schemas
class FinancialBreakdownItem(BaseModel):
    Category: str
    Amount: float

class FinancialReportSummary(BaseModel):
    GrossSales: float
    DiscountsApplied: float
    SalesReturns: float
    TotalRevenue: float
    TotalCOGS: float
    InventoryLoss: float
    GrossProfit: float
    TotalExpenses: float
    NetProfit: float
    ProfitMargin: float

class FinancialTrendPoint(BaseModel):
    label: str
    revenue: float
    expenses: float
    profit: float

class FinancialReportResponse(BaseModel):
    summary: FinancialReportSummary
    income_breakdown: List[FinancialBreakdownItem]
    expense_breakdown: List[FinancialBreakdownItem]
    trend_data: List[FinancialTrendPoint]


class PDFExportRequest(BaseModel):
    timeframe: str = 'this_month'
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    chart_image: Optional[str] = None  # Base64 encoded PNG or JPEG image of the chart
    
    # Specific filters depending on tab
    customer_id: Optional[str] = None
    payment_method: Optional[str] = None
    supplier_id: Optional[str] = None
    report_type: Optional[str] = 'expiry' # for medicine tab
