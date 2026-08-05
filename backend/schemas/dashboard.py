from pydantic import BaseModel
from typing import Optional

class DashboardSummaryResponse(BaseModel):
    # Today's Business
    today_sales: float
    today_purchases: float
    today_profit: float
    transactions_today: int
    
    # Inventory Health
    current_stock_value: float
    low_stock_count: int
    out_of_stock_count: int
    expiring_soon_count: int
    
    # Business Overview
    total_medicines: int
    total_customers: int
    total_suppliers: int
    expired_medicines: int
    
    # Overall Financial Summary
    total_sales: float
    total_purchases: float
    net_profit: float

class DailyTrend(BaseModel):
    date: str
    value: float

class TopMedicine(BaseModel):
    name: str
    quantity: int

class SalesByCategory(BaseModel):
    category: str
    total_sales: float

class MonthlyComparison(BaseModel):
    month: str
    sales: float
    purchases: float

class DashboardChartsResponse(BaseModel):
    sales_trend: list[DailyTrend]
    purchase_trend: list[DailyTrend]
    profit_trend: list[DailyTrend]
    top_medicines: list[TopMedicine]
    sales_by_category: list[SalesByCategory]
    monthly_comparison: list[MonthlyComparison]

class RecentSale(BaseModel):
    sales_id: int
    invoice_no: str
    date: str
    amount: float
    customer: str
    status: str

class LowStock(BaseModel):
    medicine_id: int
    name: str
    current_quantity: int
    reorder_level: int

class ExpiryAlert(BaseModel):
    batch_id: int
    batch_number: str
    medicine_name: str
    expiry_date: str
    quantity: int

class DashboardWidgetsResponse(BaseModel):
    recent_sales: list[RecentSale]
    low_stock: list[LowStock]
    expiry_alerts: list[ExpiryAlert]
