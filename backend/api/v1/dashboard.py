from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from api.deps import get_db
import models
from schemas.dashboard import DashboardSummaryResponse, DashboardChartsResponse, DashboardWidgetsResponse
from core.config import settings

router = APIRouter()

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    timeframe: str = 'today', 
    start_date: str = None, 
    end_date: str = None,
    db: Session = Depends(get_db)
):
    today = date.today()
    filter_start, filter_end = get_date_range(timeframe, start_date, end_date)

    # --- Today's Business ---
    # Filtered Sales
    today_sales = db.query(func.sum(models.Sale.GrandTotal)).filter(
        func.date(models.Sale.TransactionDate) >= filter_start,
        func.date(models.Sale.TransactionDate) <= filter_end,
        models.Sale.Status == "Completed"
    ).scalar() or 0.0

    # Filtered Purchases
    today_purchases = db.query(func.sum(models.Purchase.GrandTotal)).filter(
        func.date(models.Purchase.PurchaseDate) >= filter_start,
        func.date(models.Purchase.PurchaseDate) <= filter_end
    ).scalar() or 0.0

    # Filtered COGS
    today_cogs = db.query(
        func.sum(models.SaleItem.Quantity * models.StockBatch.CostPrice)
    ).join(
        models.StockBatch, models.SaleItem.BatchId == models.StockBatch.BatchId
    ).join(
        models.Sale, models.SaleItem.SalesId == models.Sale.SalesId
    ).filter(
        func.date(models.Sale.TransactionDate) >= filter_start,
        func.date(models.Sale.TransactionDate) <= filter_end,
        models.Sale.Status == "Completed"
    ).scalar() or 0.0

    today_profit = float(today_sales) - float(today_cogs)

    # Filtered Transactions
    today_sales_count = db.query(models.Sale).filter(
        func.date(models.Sale.TransactionDate) >= filter_start,
        func.date(models.Sale.TransactionDate) <= filter_end
    ).count()
    today_purchases_count = db.query(models.Purchase).filter(
        func.date(models.Purchase.PurchaseDate) >= filter_start,
        func.date(models.Purchase.PurchaseDate) <= filter_end
    ).count()
    transactions_today = today_sales_count + today_purchases_count

    # --- Inventory Health ---
    # Current Stock Value
    current_stock_value = db.query(
        func.sum(models.StockBatch.Quantity * models.StockBatch.CostPrice)
    ).filter(
        models.StockBatch.Quantity > 0
    ).scalar() or 0.0

    # Total quantity per medicine
    medicine_stocks = db.query(
        models.StockBatch.MedicineId,
        func.sum(models.StockBatch.Quantity).label('total_qty')
    ).group_by(models.StockBatch.MedicineId).subquery()

    # Low Stock (quantity > 0 but <= reorder level)
    low_stock_count = db.query(models.Medicine).join(
        medicine_stocks, models.Medicine.MedicineId == medicine_stocks.c.MedicineId
    ).filter(
        medicine_stocks.c.total_qty > 0,
        medicine_stocks.c.total_qty <= models.Medicine.ReorderLevel,
        models.Medicine.IsActive == True
    ).count()

    # Out of Stock (quantity == 0 or no batches)
    # Medicines that either have no batches or their total sum is 0
    medicines_with_stock = db.query(models.Medicine).outerjoin(
        medicine_stocks, models.Medicine.MedicineId == medicine_stocks.c.MedicineId
    ).filter(
        (medicine_stocks.c.total_qty == None) | (medicine_stocks.c.total_qty == 0),
        models.Medicine.IsActive == True
    ).count()
    out_of_stock_count = medicines_with_stock

    # Expiring Soon
    expiry_threshold = today + timedelta(days=settings.EXPIRY_ALERT_DAYS)
    expiring_soon_count = db.query(models.StockBatch).filter(
        models.StockBatch.Quantity > 0,
        models.StockBatch.ExpiryDate > today,
        models.StockBatch.ExpiryDate <= expiry_threshold
    ).count()

    # --- Business Overview ---
    total_medicines = db.query(models.Medicine).filter(models.Medicine.IsActive == True).count()
    total_customers = db.query(models.Customer).filter(models.Customer.IsActive == True).count()
    total_suppliers = db.query(models.Supplier).filter(models.Supplier.IsActive == True).count()
    
    expired_medicines = db.query(models.StockBatch).filter(
        models.StockBatch.Quantity > 0,
        models.StockBatch.ExpiryDate <= today
    ).count()

    # --- Overall Financial Summary ---
    total_sales = db.query(func.sum(models.Sale.GrandTotal)).filter(
        models.Sale.Status == "Completed"
    ).scalar() or 0.0

    total_purchases = db.query(func.sum(models.Purchase.GrandTotal)).scalar() or 0.0

    total_cogs = db.query(
        func.sum(models.SaleItem.Quantity * models.StockBatch.CostPrice)
    ).join(
        models.StockBatch, models.SaleItem.BatchId == models.StockBatch.BatchId
    ).join(
        models.Sale, models.SaleItem.SalesId == models.Sale.SalesId
    ).filter(
        models.Sale.Status == "Completed"
    ).scalar() or 0.0

    net_profit = float(total_sales) - float(total_cogs)

    return DashboardSummaryResponse(
        today_sales=float(today_sales),
        today_purchases=float(today_purchases),
        today_profit=float(today_profit),
        transactions_today=transactions_today,
        
        current_stock_value=float(current_stock_value),
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        expiring_soon_count=expiring_soon_count,
        
        total_medicines=total_medicines,
        total_customers=total_customers,
        total_suppliers=total_suppliers,
        expired_medicines=expired_medicines,
        
        total_sales=float(total_sales),
        total_purchases=float(total_purchases),
        net_profit=float(net_profit)
    )

def get_date_range(timeframe: str, start_date: str = None, end_date: str = None):
    today = date.today()
    if timeframe == 'custom' and start_date and end_date:
        from datetime import datetime
        try:
            sd = datetime.strptime(start_date, '%Y-%m-%d').date()
            ed = datetime.strptime(end_date, '%Y-%m-%d').date()
            return sd, ed
        except ValueError:
            return today, today
    elif timeframe == 'today':
        return today, today
    elif timeframe == 'yesterday':
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif timeframe == 'last_7_days' or timeframe == 'week':
        return today - timedelta(days=6), today
    elif timeframe == 'last_30_days' or timeframe == 'month':
        return today - timedelta(days=29), today
    elif timeframe == 'this_month':
        return today.replace(day=1), today
    elif timeframe == 'last_month':
        first_day_this_month = today.replace(day=1)
        last_day_last_month = first_day_this_month - timedelta(days=1)
        first_day_last_month = last_day_last_month.replace(day=1)
        return first_day_last_month, last_day_last_month
    elif timeframe == 'this_year' or timeframe == 'year':
        return today.replace(month=1, day=1), today
    else:
        # Default to today
        return today, today

def generate_date_sequence(start_date, end_date, interval='daily'):
    dates = []
    current_date = start_date
    if interval == 'monthly':
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m'))
            # Move to next month
            next_month = current_date.month % 12 + 1
            next_year = current_date.year + (current_date.month // 12)
            current_date = current_date.replace(year=next_year, month=next_month, day=1)
    else:
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
    return dates

@router.get("/charts", response_model=DashboardChartsResponse)
def get_dashboard_charts(
    timeframe: str = 'last_30_days', 
    start_date: str = None, 
    end_date: str = None,
    db: Session = Depends(get_db)
):
    start_date, end_date = get_date_range(timeframe, start_date, end_date)
    interval = 'monthly' if timeframe == 'this_year' else 'daily'
    date_seq = generate_date_sequence(start_date, end_date, interval)

    # Dictionary for padding
    sales_dict = {d: 0.0 for d in date_seq}
    purchase_dict = {d: 0.0 for d in date_seq}
    profit_dict = {d: 0.0 for d in date_seq}

    # Format string for SQLite strftime
    fmt = '%Y-%m' if interval == 'monthly' else '%Y-%m-%d'

    # 1. Sales Trend
    sales_results = db.query(
        func.strftime(fmt, models.Sale.TransactionDate).label('period'),
        func.sum(models.Sale.GrandTotal).label('total')
    ).filter(
        func.date(models.Sale.TransactionDate) >= start_date,
        func.date(models.Sale.TransactionDate) <= end_date,
        models.Sale.Status == "Completed"
    ).group_by('period').all()
    for row in sales_results:
        if row.period in sales_dict:
            sales_dict[row.period] = float(row.total or 0.0)

    # 2. Purchase Trend
    purchase_results = db.query(
        func.strftime(fmt, models.Purchase.PurchaseDate).label('period'),
        func.sum(models.Purchase.GrandTotal).label('total')
    ).filter(
        func.date(models.Purchase.PurchaseDate) >= start_date,
        func.date(models.Purchase.PurchaseDate) <= end_date
    ).group_by('period').all()
    for row in purchase_results:
        if row.period in purchase_dict:
            purchase_dict[row.period] = float(row.total or 0.0)

    # 3. Profit Trend (COGS based)
    cogs_results = db.query(
        func.strftime(fmt, models.Sale.TransactionDate).label('period'),
        func.sum(models.SaleItem.Quantity * models.StockBatch.CostPrice).label('total_cogs')
    ).join(
        models.StockBatch, models.SaleItem.BatchId == models.StockBatch.BatchId
    ).join(
        models.Sale, models.SaleItem.SalesId == models.Sale.SalesId
    ).filter(
        func.date(models.Sale.TransactionDate) >= start_date,
        func.date(models.Sale.TransactionDate) <= end_date,
        models.Sale.Status == "Completed"
    ).group_by('period').all()
    
    # Calculate profit = sales - cogs per period
    for row in cogs_results:
        if row.period in profit_dict:
            profit_dict[row.period] = sales_dict[row.period] - float(row.total_cogs or 0.0)
    # Ensure periods with sales but no cogs still have profit recorded correctly (profit = sales)
    for period in sales_dict:
        if period not in [r.period for r in cogs_results]:
            profit_dict[period] = sales_dict[period]

    sales_trend = [{"date": k, "value": v} for k, v in sales_dict.items()]
    purchase_trend = [{"date": k, "value": v} for k, v in purchase_dict.items()]
    profit_trend = [{"date": k, "value": v} for k, v in profit_dict.items()]

    # 4. Top Selling Medicines (Horizontal Bar Chart)
    # Top 5 or 10 medicines in the timeframe
    top_meds = db.query(
        models.Medicine.BrandName.label('name'),
        func.sum(models.SaleItem.Quantity).label('quantity')
    ).join(
        models.StockBatch, models.SaleItem.BatchId == models.StockBatch.BatchId
    ).join(
        models.Medicine, models.StockBatch.MedicineId == models.Medicine.MedicineId
    ).join(
        models.Sale, models.SaleItem.SalesId == models.Sale.SalesId
    ).filter(
        func.date(models.Sale.TransactionDate) >= start_date,
        func.date(models.Sale.TransactionDate) <= end_date,
        models.Sale.Status == "Completed"
    ).group_by(models.Medicine.BrandName).order_by(func.sum(models.SaleItem.Quantity).desc()).limit(10).all()

    top_medicines = [{"name": m.name, "quantity": int(m.quantity)} for m in top_meds]

    # 5. Sales by Category (Donut Chart)
    # Handle NULL category as "Uncategorized"
    cat_sales = db.query(
        func.coalesce(models.Category.CategoryName, 'Uncategorized').label('category'),
        func.sum(models.SaleItem.TotalPrice).label('total_sales')
    ).join(
        models.StockBatch, models.SaleItem.BatchId == models.StockBatch.BatchId
    ).join(
        models.Medicine, models.StockBatch.MedicineId == models.Medicine.MedicineId
    ).outerjoin(
        models.Category, models.Medicine.CategoryId == models.Category.CategoryId
    ).join(
        models.Sale, models.SaleItem.SalesId == models.Sale.SalesId
    ).filter(
        func.date(models.Sale.TransactionDate) >= start_date,
        func.date(models.Sale.TransactionDate) <= end_date,
        models.Sale.Status == "Completed"
    ).group_by(func.coalesce(models.Category.CategoryName, 'Uncategorized')).all()

    sales_by_category = [{"category": str(c.category), "total_sales": float(c.total_sales or 0.0)} for c in cat_sales]

    # 6. Monthly Sales vs Purchases (Last 12 months from today)
    today = date.today()
    twelve_months_ago = today.replace(day=1) - timedelta(days=365)
    twelve_months_seq = generate_date_sequence(twelve_months_ago.replace(day=1), today, 'monthly')[-12:]
    
    monthly_sales_dict = {m: 0.0 for m in twelve_months_seq}
    monthly_purchases_dict = {m: 0.0 for m in twelve_months_seq}

    m_sales = db.query(
        func.strftime('%Y-%m', models.Sale.TransactionDate).label('month'),
        func.sum(models.Sale.GrandTotal).label('total')
    ).filter(
        func.date(models.Sale.TransactionDate) >= twelve_months_ago,
        models.Sale.Status == "Completed"
    ).group_by('month').all()
    for row in m_sales:
        if row.month in monthly_sales_dict:
            monthly_sales_dict[row.month] = float(row.total or 0.0)

    m_purchases = db.query(
        func.strftime('%Y-%m', models.Purchase.PurchaseDate).label('month'),
        func.sum(models.Purchase.GrandTotal).label('total')
    ).filter(
        func.date(models.Purchase.PurchaseDate) >= twelve_months_ago
    ).group_by('month').all()
    for row in m_purchases:
        if row.month in monthly_purchases_dict:
            monthly_purchases_dict[row.month] = float(row.total or 0.0)

    monthly_comparison = [
        {"month": m, "sales": monthly_sales_dict[m], "purchases": monthly_purchases_dict[m]}
        for m in twelve_months_seq
    ]

    return DashboardChartsResponse(
        sales_trend=sales_trend,
        purchase_trend=purchase_trend,
        profit_trend=profit_trend,
        top_medicines=top_medicines,
        sales_by_category=sales_by_category,
        monthly_comparison=monthly_comparison
    )

@router.get("/widgets", response_model=DashboardWidgetsResponse)
def get_dashboard_widgets(
    timeframe: str = 'today', 
    start_date: str = None, 
    end_date: str = None,
    db: Session = Depends(get_db)
):
    today = date.today()
    filter_start, filter_end = get_date_range(timeframe, start_date, end_date)
    
    # 1. Recent Sales
    sales = db.query(models.Sale).filter(
        func.date(models.Sale.TransactionDate) >= filter_start,
        func.date(models.Sale.TransactionDate) <= filter_end
    ).order_by(models.Sale.TransactionDate.desc()).limit(10).all()
    recent_sales = []
    for s in sales:
        # Assuming Customer relationship exists or fallback to InvoiceNo
        customer_name = "Walk-in"
        if s.customer:
            customer_name = s.customer.FullName
            
        recent_sales.append({
            "sales_id": s.SalesId,
            "invoice_no": s.InvoiceNumber,
            "date": s.TransactionDate.strftime('%Y-%m-%d %H:%M'),
            "amount": float(s.GrandTotal),
            "customer": customer_name,
            "status": s.Status
        })

    # 2. Low Stock (Quantity <= ReorderLevel AND ExpiryDate > today)
    # The requirement specifies: Calculate Low Stock levels based strictly on non-expired, sellable stock quantity.
    active_stocks = db.query(
        models.StockBatch.MedicineId,
        func.sum(models.StockBatch.Quantity).label('total_qty')
    ).filter(
        models.StockBatch.ExpiryDate > today
    ).group_by(models.StockBatch.MedicineId).subquery()

    low_stock_meds = db.query(models.Medicine, active_stocks.c.total_qty).join(
        active_stocks, models.Medicine.MedicineId == active_stocks.c.MedicineId
    ).filter(
        active_stocks.c.total_qty <= models.Medicine.ReorderLevel,
        models.Medicine.IsActive == True
    ).all()

    low_stock = []
    for med, qty in low_stock_meds:
        low_stock.append({
            "medicine_id": med.MedicineId,
            "name": med.BrandName,
            "current_quantity": int(qty or 0),
            "reorder_level": med.ReorderLevel
        })

    # 3. Expiry Alerts (ExpiryDate <= today + settings.EXPIRY_ALERT_DAYS AND Quantity > 0 AND ExpiryDate > today)
    # Actually, we also want to show things that have already expired if they still have quantity? 
    # Usually expiry alert is for upcoming. Let's do ExpiryDate <= today + EXPIRY_ALERT_DAYS
    expiry_threshold = today + timedelta(days=settings.EXPIRY_ALERT_DAYS)
    expiring_batches = db.query(models.StockBatch).filter(
        models.StockBatch.Quantity > 0,
        models.StockBatch.ExpiryDate <= expiry_threshold
    ).order_by(models.StockBatch.ExpiryDate.asc()).all()

    expiry_alerts = []
    for b in expiring_batches:
        # We need medicine name. Luckily StockBatch has a 'medicine' relationship.
        med_name = b.medicine.BrandName if b.medicine else "Unknown"
        expiry_alerts.append({
            "batch_id": b.BatchId,
            "batch_number": b.BatchNumber,
            "medicine_name": med_name,
            "expiry_date": b.ExpiryDate.strftime('%Y-%m-%d'),
            "quantity": b.Quantity
        })

    return DashboardWidgetsResponse(
        recent_sales=recent_sales,
        low_stock=low_stock,
        expiry_alerts=expiry_alerts
    )
