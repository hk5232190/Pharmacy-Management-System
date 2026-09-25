from fastapi import APIRouter, Depends, Query, Response, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from datetime import date, timedelta, datetime, timezone
import csv
import openpyxl

from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import base64
import os
import tempfile
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
import io

from api.deps import get_db, get_current_user


def _get_now_str():
    from datetime import datetime
    return datetime.now().strftime("%d-%m-%Y %I:%M %p")
import models
from schemas.reports import (
    FinancialBreakdownItem, FinancialReportSummary, FinancialTrendPoint, FinancialReportResponse,
    SalesReportResponse, SalesReportSummary, SalesTransaction, SalesTrendPoint, PaymentMethodStats, TopMedicineStats,
    PurchaseReportResponse, PurchaseReportSummary, PurchaseTransaction, PurchaseTrendPoint, SupplierStats, TopPurchasedMedicineStats,
    InventoryReportResponse, InventoryReportSummary, InventoryMovementSummary, InventoryStockItem, StockValueByCategory, MedicineMovementItem,
    MedicineReportResponse, MedicineReportSummary, MedicineExpiryItem, MedicineLowStockItem, MedicineMovementAnalyticsItem, PaginationMetadata
)


from pydantic import BaseModel
from typing import Optional

class PDFExportRequest(BaseModel):
    timeframe: str = 'this_month'
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    chart_image: Optional[str] = None
    customer_id: Optional[str] = None
    payment_method: Optional[str] = None
    supplier_id: Optional[str] = None
    report_type: Optional[str] = 'expiry'

router = APIRouter(dependencies=[Depends(get_current_user)])

def get_reports_date_range(timeframe: str, start_date: str = None, end_date: str = None):
    today = date.today()
    if timeframe == 'custom' and start_date and end_date:
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
        return today, today

def generate_trend_sequence(start_date: date, end_date: date, interval: str):
    dates = []
    if interval == 'hourly':
        for i in range(24):
            dates.append(f"{i:02d}:00")
    elif interval == 'monthly':
        current_date = start_date.replace(day=1)
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m'))
            next_month = current_date.month % 12 + 1
            next_year = current_date.year + (current_date.month // 12)
            current_date = current_date.replace(year=next_year, month=next_month, day=1)
    else:
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
    return dates

def fetch_sales_report_data(
    db: Session, 
    start_date: date, 
    end_date: date, 
    customer_id: str = None, 
    payment_method: str = None
):
    base_query = db.query(models.Sale).filter(
        func.date(models.Sale.TransactionDate, 'localtime') >= start_date,
        func.date(models.Sale.TransactionDate, 'localtime') <= end_date
    )
    if customer_id and customer_id != "all":
        base_query = base_query.filter(models.Sale.CustomerId == customer_id)
    if payment_method and payment_method != "all":
        base_query = base_query.filter(models.Sale.PaymentMethod == payment_method)

    completed_sales = base_query.options(
        joinedload(models.Sale.customer),
        selectinload(models.Sale.items),
    ).filter(~models.Sale.Status.in_(["Returned", "Fully Refunded", "Cancelled"])).all()
    # Returns from SaleReturn model
    returns_query = db.query(models.SaleReturn).filter(
        func.date(models.SaleReturn.ReturnDate, 'localtime') >= start_date,
        func.date(models.SaleReturn.ReturnDate, 'localtime') <= end_date
    )
    if customer_id and customer_id != "all":
        returns_query = returns_query.join(models.Sale).filter(models.Sale.CustomerId == customer_id)
    
    returned_sales = returns_query.all()
    
    total_gross_sales = sum(float(s.GrandTotal or 0.0) for s in completed_sales)
    total_returns = sum(float(r.TotalRefundAmount or 0.0) for r in returned_sales)
    net_sales = sum(float(s.NetAmount or 0.0) for s in completed_sales)

    # Calculate COGS dynamically — pre-fetch all relevant batches to avoid N+1 queries
    all_batch_ids = list({item.BatchId for sale in completed_sales for item in sale.items})
    batch_map = {
        b.BatchId: b
        for b in db.query(models.StockBatch)
        .options(joinedload(models.StockBatch.medicine))
        .filter(models.StockBatch.BatchId.in_(all_batch_ids)).all()
    } if all_batch_ids else {}
    total_cogs = 0
    for sale in completed_sales:
        for item in sale.items:
            batch = batch_map.get(item.BatchId)
            if batch:
                total_cogs += ((item.Quantity - item.ReturnedQuantity) * float(batch.CostPrice or 0.0))

    net_profit = net_sales - total_cogs
    profit_margin = (net_profit / net_sales * 100) if net_sales > 0 else 0.0
    total_invoices = len(completed_sales)
    average_sale = (net_sales / total_invoices) if total_invoices > 0 else 0.0
    highest_sale = max([float(s.GrandTotal or 0.0) for s in completed_sales], default=0.0)

    summary = SalesReportSummary(
        TotalGrossSales=total_gross_sales,
        TotalReturns=total_returns,
        NetSales=net_sales,
        TotalCOGS=total_cogs,
        NetProfit=net_profit,
        ProfitMarginPercent=profit_margin,
        TotalInvoices=total_invoices,
        AverageSale=average_sale,
        HighestSale=highest_sale
    )

    transactions = []
    for s in completed_sales:
        customer_name = s.customer.Name if s.customer else "Walk-in"
        total_qty = sum(i.Quantity for i in s.items)
        tx_dt = s.TransactionDate
        if tx_dt and tx_dt.tzinfo is None:
            tx_dt = tx_dt.replace(tzinfo=timezone.utc)
        transactions.append(SalesTransaction(
            InvoiceNo=s.InvoiceNumber or str(s.SalesId),
            TransactionDate=tx_dt,
            CustomerName=customer_name,
            MedicinesSold=len(s.items),
            TotalQty=total_qty,
            Discount=s.DiscountAmount,
            Tax=s.TaxAmount,
            GrandTotal=float(s.NetAmount or 0.0),
            PaymentMethod=s.PaymentMethod,
            Status=s.Status
        ))

    # Trend Data
    days_diff = (end_date - start_date).days
    if days_diff == 0:
        interval = 'hourly'
        fmt = '%H:00'
    elif days_diff > 60:
        interval = 'monthly'
        fmt = '%Y-%m'
    else:
        interval = 'daily'
        fmt = '%Y-%m-%d'

    date_seq = generate_trend_sequence(start_date, end_date, interval)
    trend_dict = {d: {"sales": 0.0, "cogs": 0.0} for d in date_seq}

    for s in completed_sales:
        if s.TransactionDate:
            local_dt = s.TransactionDate.replace(tzinfo=timezone.utc).astimezone() if s.TransactionDate.tzinfo is None else s.TransactionDate.astimezone()
            period = local_dt.strftime(fmt)
        else:
            period = ""
        if period in trend_dict:
            trend_dict[period]["sales"] += float(s.NetAmount or 0.0)
            sale_cogs = sum(
                (i.Quantity - i.ReturnedQuantity) * float(batch_map[i.BatchId].CostPrice or 0.0)
                for i in s.items if i.BatchId in batch_map
            )
            trend_dict[period]["cogs"] += sale_cogs

    trend_data = []
    for d in date_seq:
        s = trend_dict[d]["sales"]
        c = trend_dict[d]["cogs"]
        p = s - c
        trend_data.append(SalesTrendPoint(label=d, sales=s, profit=p))

    # Payment Methods
    pm_dict = {}
    for s in completed_sales:
        pm = s.PaymentMethod or 'Unknown'
        pm_dict[pm] = pm_dict.get(pm, 0) + float(s.GrandTotal or 0.0)
    payment_methods = [PaymentMethodStats(name=k, value=v) for k, v in pm_dict.items()]

    # Top Medicines — reuse the already-fetched batch_map
    med_dict = {}
    for s in completed_sales:
        for i in s.items:
            batch = batch_map.get(i.BatchId)
            if batch and batch.medicine:
                name = batch.medicine.BrandName
                if name not in med_dict:
                    med_dict[name] = {"qty": 0, "rev": 0.0}
                med_dict[name]["qty"] += i.Quantity
                med_dict[name]["rev"] += float(i.TotalPrice or 0.0)

    top_meds_sorted = sorted(med_dict.items(), key=lambda x: x[1]["rev"], reverse=True)[:5]
    top_medicines = [TopMedicineStats(name=k, quantity=v["qty"], revenue=v["rev"]) for k, v in top_meds_sorted]

    return SalesReportResponse(
        summary=summary,
        trend_data=trend_data,
        payment_methods=payment_methods,
        top_medicines=top_medicines,
        transactions=transactions
    )

@router.get("/sales")
def get_sales_report(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    customer_id: str = None,
    payment_method: str = None,
    db: Session = Depends(get_db)
):
    try:
        sd, ed = get_reports_date_range(timeframe, start_date, end_date)
        return fetch_sales_report_data(db, sd, ed, customer_id, payment_method)
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@router.get("/sales/export/csv")
def export_sales_report_csv(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    customer_id: str = None,
    payment_method: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_sales_report_data(db, sd, ed, customer_id, payment_method)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Invoice No', 'Date', 'Customer', 'Medicines Sold', 'Total Qty', 'Discount', 'Tax', 'Grand Total', 'Payment Method', 'Status'])
    
    for t in report_data.transactions:
        t_dt = t.TransactionDate.astimezone() if t.TransactionDate.tzinfo else t.TransactionDate
        writer.writerow([
            t.InvoiceNo, 
            t_dt.strftime("%Y-%m-%d %H:%M:%S"),
            t.CustomerName,
            t.MedicinesSold,
            t.TotalQty,
            round(t.Discount, 2),
            round(t.Tax, 2),
            round(t.GrandTotal, 2),
            t.PaymentMethod,
            t.Status
        ])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=sales_report_{sd}_to_{ed}.csv"
    return response

def fetch_purchase_report_data(
    db: Session, 
    start_date: date, 
    end_date: date, 
    supplier_id: str = None
):
    base_query = db.query(models.Purchase).filter(
        func.date(models.Purchase.PurchaseDate, 'localtime') >= start_date,
        func.date(models.Purchase.PurchaseDate, 'localtime') <= end_date
    )
    if supplier_id and supplier_id != "all":
        base_query = base_query.filter(models.Purchase.SupplierId == supplier_id)

    completed_purchases = base_query.options(
        joinedload(models.Purchase.supplier),
        selectinload(models.Purchase.items),
    ).all()
    # Calculate Purchase Returns correctly using the PurchaseReturn model
    returns_query = db.query(models.PurchaseReturn).filter(
        func.date(models.PurchaseReturn.ReturnDate, 'localtime') >= start_date,
        func.date(models.PurchaseReturn.ReturnDate, 'localtime') <= end_date
    )
    if supplier_id and supplier_id != "all":
        returns_query = returns_query.filter(models.PurchaseReturn.SupplierId == supplier_id)
        
    returned_purchases = returns_query.all()

    total_gross_purchases = sum(float(p.GrandTotal or 0.0) for p in completed_purchases)
    total_returns = sum(float(r.TotalRefundAmount or 0.0) for r in returned_purchases)
    net_purchases = total_gross_purchases - total_returns

    total_invoices = len(completed_purchases)
    average_purchase = (net_purchases / total_invoices) if total_invoices > 0 else 0.0
    highest_purchase = max([float(p.GrandTotal or 0.0) for p in completed_purchases], default=0.0)

    summary = PurchaseReportSummary(
        TotalGrossPurchases=total_gross_purchases,
        TotalReturns=total_returns,
        NetPurchases=net_purchases,
        TotalInvoices=total_invoices,
        AveragePurchase=average_purchase,
        HighestPurchase=highest_purchase
    )

    transactions = []
    for p in completed_purchases:
        supplier_name = p.supplier.Name if p.supplier else "Unknown"
        total_qty = sum(i.Quantity for i in p.items)
        p_dt = p.PurchaseDate
        if p_dt and p_dt.tzinfo is None:
            p_dt = p_dt.replace(tzinfo=timezone.utc)
        transactions.append(PurchaseTransaction(
            InvoiceNo=p.InvoiceNumber or str(p.PurchaseId),
            PurchaseDate=p_dt,
            SupplierName=supplier_name,
            MedicinesPurchased=len(p.items),
            TotalQty=total_qty,
            Discount=p.TotalDiscount,
            Tax=p.TotalTax,
            GrandTotal=float(p.NetAmount or 0.0),
            Status=p.PaymentStatus
        ))

    # Trend Data
    days_diff = (end_date - start_date).days
    if days_diff == 0:
        interval = 'hourly'
        fmt = '%H:00'
    elif days_diff > 60:
        interval = 'monthly'
        fmt = '%Y-%m'
    else:
        interval = 'daily'
        fmt = '%Y-%m-%d'

    date_seq = generate_trend_sequence(start_date, end_date, interval)
    trend_dict = {d: 0.0 for d in date_seq}

    for p in completed_purchases:
        if p.PurchaseDate:
            local_p_dt = p.PurchaseDate.replace(tzinfo=timezone.utc).astimezone() if p.PurchaseDate.tzinfo is None else p.PurchaseDate.astimezone()
            period = local_p_dt.strftime(fmt)
        else:
            period = ""
        if period in trend_dict:
            trend_dict[period] += float(p.NetAmount or 0.0)

    trend_data = []
    for d in date_seq:
        trend_data.append(PurchaseTrendPoint(label=d, purchases=trend_dict[d]))

    # Suppliers Breakdown
    supp_dict = {}
    for p in completed_purchases:
        s_name = p.supplier.Name if p.supplier else 'Unknown'
        supp_dict[s_name] = supp_dict.get(s_name, 0) + float(p.NetAmount or 0.0)
    suppliers = [SupplierStats(name=k, value=v) for k, v in supp_dict.items()]

    # Top Medicines — pre-fetch all medicines in one query to avoid N+1
    all_med_ids = list({i.MedicineId for p in completed_purchases for i in p.items if i.MedicineId})
    medicine_map = {m.MedicineId: m for m in db.query(models.Medicine).filter(models.Medicine.MedicineId.in_(all_med_ids)).all()} if all_med_ids else {}
    med_dict = {}
    for p in completed_purchases:
        for i in p.items:
            med = medicine_map.get(i.MedicineId)
            name = med.BrandName if med else "Unknown"
            if name not in med_dict:
                med_dict[name] = {"qty": 0, "cost": 0.0}
            med_dict[name]["qty"] += i.Quantity
            med_dict[name]["cost"] += float(i.LineTotal or 0.0)

    top_meds_sorted = sorted(med_dict.items(), key=lambda x: x[1]["cost"], reverse=True)[:5]
    top_medicines = [TopPurchasedMedicineStats(name=k, quantity=v["qty"], cost=v["cost"]) for k, v in top_meds_sorted]

    return PurchaseReportResponse(
        summary=summary,
        trend_data=trend_data,
        suppliers=suppliers,
        top_medicines=top_medicines,
        transactions=transactions
    )

@router.get("/purchases")
def get_purchase_report(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    supplier_id: str = None,
    db: Session = Depends(get_db)
):
    try:
        sd, ed = get_reports_date_range(timeframe, start_date, end_date)
        return fetch_purchase_report_data(db, sd, ed, supplier_id)
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@router.get("/purchases/export/csv")
def export_purchase_report_csv(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    supplier_id: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_purchase_report_data(db, sd, ed, supplier_id)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Invoice No', 'Date', 'Supplier', 'Medicines Purchased', 'Total Qty', 'Discount', 'Tax', 'Grand Total', 'Status'])
    
    for t in report_data.transactions:
        writer.writerow([
            t.InvoiceNo, 
            t.PurchaseDate.strftime("%Y-%m-%d %H:%M:%S"),
            t.SupplierName,
            t.MedicinesPurchased,
            t.TotalQty,
            round(t.Discount, 2),
            round(t.Tax, 2),
            round(t.GrandTotal, 2),
            t.Status
        ])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=purchase_report_{sd}_to_{ed}.csv"
    return response

def fetch_inventory_report_data(
    db: Session,
    start_date: date = None,
    end_date: date = None
):
    today = date.today()
    # 1. Snapshot metrics
    batches = db.query(models.StockBatch).all()
    
    inv_settings = db.query(models.InventorySettings).first()
    low_stock_threshold = inv_settings.LowStockThreshold if inv_settings else 10
    expiry_alert_days = inv_settings.ExpiryAlertDays if inv_settings else 90
    
    total_cost_value = 0.0
    total_retail_value = 0.0
    expired_valuation = 0.0
    
    # Pre-fetch medicines to avoid N+1 and get Category info
    medicines_db = db.query(models.Medicine).filter(models.Medicine.IsActive == True).all()
    medicine_map = {m.MedicineId: m for m in medicines_db}
    
    categories = db.query(models.Category).all()
    cat_map = {c.CategoryId: c for c in categories}
    
    low_stock_count = 0
    out_of_stock_count = 0
    
    # Calculate stock per medicine to determine low/out of stock
    med_stock_map = {m.MedicineId: 0 for m in medicines_db}
    
    stock_items = []
    category_valuation_map = {}
    
    for b in batches:
        med = medicine_map.get(b.MedicineId)
        if not med:
            continue
            
        qty = b.Quantity
        cost = float(b.CostPrice)
        sell = float(b.SellingPrice)
        expiry = b.ExpiryDate
        
        is_expired = expiry < today
        val_cost = qty * cost
        val_retail = qty * sell
        
        min_stock = med.ReorderLevel if med.ReorderLevel and med.ReorderLevel > 0 else low_stock_threshold
        max_stock = (min_stock * 3) if min_stock > 0 else None

        if is_expired:
            expired_valuation += val_cost
            status = 'Expired'
        elif qty <= 0:
            status = 'Out of Stock'
        elif qty <= min_stock:
            status = 'Low Stock'
            total_cost_value += val_cost
            total_retail_value += val_retail
            med_stock_map[b.MedicineId] += qty
        elif max_stock is not None and qty > max_stock:
            status = 'Overstock'
            total_cost_value += val_cost
            total_retail_value += val_retail
            med_stock_map[b.MedicineId] += qty
        else:
            total_cost_value += val_cost
            total_retail_value += val_retail
            status = 'In Stock'
            med_stock_map[b.MedicineId] += qty
            
        # Category Valuation (only active sellable)
        if not is_expired and qty > 0:
            cat_name = cat_map[med.CategoryId].CategoryName if med.CategoryId in cat_map else 'Unknown'
            category_valuation_map[cat_name] = category_valuation_map.get(cat_name, 0.0) + val_cost
            
        stock_items.append(InventoryStockItem(
            MedicineName=med.BrandName,
            Category=cat_map[med.CategoryId].CategoryName if med.CategoryId in cat_map else 'Unknown',
            BatchCode=b.BatchCode,
            Quantity=qty,
            CostPrice=cost,
            SellingPrice=sell,
            TotalCostValue=val_cost,
            TotalRetailValue=val_retail,
            ExpiryDate=expiry,
            Status=status
        ))
    
    low_stock_count = sum(1 for item in stock_items if item.Status == 'Low Stock')
    out_of_stock_count = sum(1 for item in stock_items if item.Status == 'Out of Stock')
            
    summary = InventoryReportSummary(
        TotalCostValue=total_cost_value,
        TotalRetailValue=total_retail_value,
        ExpiredWrittenOffValuation=expired_valuation,
        TotalItemsInStock=sum(med_stock_map.values()),
        LowStockCount=low_stock_count,
        OutOfStockCount=out_of_stock_count
    )
    
    category_valuation = [StockValueByCategory(name=k, value=v) for k, v in category_valuation_map.items()]
    
    # 2. Movement metrics (if date range provided)
    movement_summary = None
    movement_items = None
    
    if start_date and end_date:
        purchases = db.query(models.PurchaseItem).join(models.Purchase).filter(
            func.date(models.Purchase.PurchaseDate, 'localtime') >= start_date,
            func.date(models.Purchase.PurchaseDate, 'localtime') <= end_date
        ).all()
        
        sales = db.query(models.SaleItem).options(joinedload(models.SaleItem.batch)).join(models.Sale).filter(
            func.date(models.Sale.TransactionDate, 'localtime') >= start_date,
            func.date(models.Sale.TransactionDate, 'localtime') <= end_date
        ).all()
        
        adjustments = db.query(models.StockAdjustment).options(joinedload(models.StockAdjustment.batch)).filter(
            func.date(models.StockAdjustment.AdjustmentDate, 'localtime') >= start_date,
            func.date(models.StockAdjustment.AdjustmentDate, 'localtime') <= end_date
        ).all()
        
        # We don't have an explicit 'expired qty' in the movement tables, 
        # but adjustments might have Reason='Expired'.
        # We'll treat adjustments with Reason='Expired' or 'Damage' as Expired/Written-Off
        
        tot_purchased = 0
        tot_sold = 0
        tot_adjusted = 0
        tot_expired_writeoff = 0
        
        med_move_map = {m.MedicineId: {"p": 0, "s": 0, "a": 0, "e": 0} for m in medicines_db}
        
        for p in purchases:
            tot_purchased += p.Quantity
            med_move_map[p.MedicineId]["p"] += p.Quantity
            
        for s in sales:
            tot_sold += s.Quantity
            # s.BatchId -> get medicine
            b = s.batch
            if b:
                med_move_map[b.MedicineId]["s"] += s.Quantity
                
        for a in adjustments:
            b = a.batch
            if not b:
                continue
                
            qty = a.Quantity if a.AdjustmentType == 'Increase' else -a.Quantity
            reason = a.Reason.lower()
            
            if 'expir' in reason or 'damag' in reason or 'write' in reason:
                # Typically negative for expiry write-offs
                tot_expired_writeoff += abs(qty)
                med_move_map[b.MedicineId]["e"] += abs(qty)
            else:
                tot_adjusted += qty
                med_move_map[b.MedicineId]["a"] += qty
                
        movement_summary = InventoryMovementSummary(
            PurchasedQty=tot_purchased,
            SoldQty=tot_sold,
            ManualAdjustmentsQty=tot_adjusted,
            ExpiredWrittenOffQty=tot_expired_writeoff
        )
        
        movement_items = []
        for m in medicines_db:
            m_move = med_move_map[m.MedicineId]
            if m_move["p"] == 0 and m_move["s"] == 0 and m_move["a"] == 0 and m_move["e"] == 0:
                continue # Skip if no movement
                
            # Current stock
            current_stock = med_stock_map[m.MedicineId]
            # Starting stock = Current - Additions + Reductions
            # Additions = Purchased + Positive Adjustments
            # Reductions = Sold + Negative Adjustments + Expired Writeoffs
            # This is a simplification (ignores returns if they aren't included in sales/purchases above).
            
            closing_stock = current_stock
            starting_stock = closing_stock - m_move["p"] + m_move["s"] - m_move["a"] + m_move["e"]
            
            movement_items.append(MedicineMovementItem(
                MedicineName=m.BrandName,
                StartingStock=starting_stock,
                PurchasedQty=m_move["p"],
                SoldQty=m_move["s"],
                AdjustedQty=m_move["a"],
                ExpiredQty=m_move["e"],
                ClosingStock=closing_stock
            ))
    
    return InventoryReportResponse(
        summary=summary,
        movement_summary=movement_summary,
        stock_items=stock_items,
        movement_items=movement_items,
        category_valuation=category_valuation
    )

@router.get("/inventory")
def get_inventory_report(
    timeframe: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    try:
        sd, ed = None, None
        if timeframe and timeframe != 'all':
            sd, ed = get_reports_date_range(timeframe, start_date, end_date)
            
        return fetch_inventory_report_data(db, sd, ed)
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@router.get("/inventory/export/csv")
def export_inventory_report_csv(
    db: Session = Depends(get_db)
):
    # For export, we typically just export current stock
    report_data = fetch_inventory_report_data(db, None, None)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Medicine', 'Category', 'Batch Code', 'Quantity', 'Cost Price', 'Selling Price', 'Total Cost Value', 'Total Retail Value', 'Expiry Date', 'Status'])
    
    for t in report_data.stock_items:
        writer.writerow([
            t.MedicineName,
            t.Category,
            t.BatchCode,
            t.Quantity,
            round(t.CostPrice, 2),
            round(t.SellingPrice, 2),
            round(t.TotalCostValue, 2),
            round(t.TotalRetailValue, 2),
            t.ExpiryDate.strftime("%Y-%m-%d") if t.ExpiryDate else '',
            t.Status
        ])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=inventory_report.csv"
    return response


def fetch_medicine_report_data(
    db: Session, 
    start_date: date, 
    end_date: date,
    report_type: str = None,
    search: str = None,
    category_id: int = None,
    page: int = 1,
    page_size: int = 10
):
    from sqlalchemy import select
    today = date.today()
    
    inv_settings = db.query(models.InventorySettings).first()
    low_stock_threshold = inv_settings.LowStockThreshold if inv_settings else 10
    expiry_alert_days = inv_settings.ExpiryAlertDays if inv_settings else 90

    # --- 1. Expiry Items (Batch-level) ---
    expiry_items = []
    total_expired = 0
    expiring_soon = 0
    
    q_expiry = db.query(
        models.StockBatch, 
        models.Medicine, 
        models.Supplier.Name.label('supplier_name')
    ).join(models.Medicine, models.StockBatch.MedicineId == models.Medicine.MedicineId)\
     .outerjoin(
        models.PurchaseItem, 
        (models.PurchaseItem.MedicineId == models.StockBatch.MedicineId) & 
        (models.PurchaseItem.BatchCode == models.StockBatch.BatchCode)
     ).outerjoin(models.Purchase, models.PurchaseItem.PurchaseId == models.Purchase.PurchaseId)\
     .outerjoin(models.Supplier, models.Purchase.SupplierId == models.Supplier.SupplierId)\
     .filter(models.StockBatch.Quantity > 0)
     
    if category_id:
        q_expiry = q_expiry.filter(models.Medicine.CategoryId == category_id)
    if search:
        q_expiry = q_expiry.filter(
            (models.Medicine.BrandName.ilike(f"%{search}%")) | 
            (models.StockBatch.BatchCode.ilike(f"%{search}%"))
        )
        
    seen_batches = set()
    for batch, medicine, supplier_name in q_expiry.all():
        if batch.BatchId in seen_batches:
            continue
        seen_batches.add(batch.BatchId)
        
        if not batch.ExpiryDate: continue
        days_to_expiry = (batch.ExpiryDate - today).days
        status = ''
        if days_to_expiry < 0:
            status = 'Expired'
            total_expired += 1
        elif days_to_expiry <= 30:
            status = 'Expiring < 30 days'
            expiring_soon += 1
        elif days_to_expiry <= expiry_alert_days:
            status = f'Expiring < {expiry_alert_days} days'
            expiring_soon += 1
        else:
            status = 'Safe'
            
        if status == 'Safe' and report_type == 'expiry':
            continue

        if status != 'Safe':
            expiry_items.append(MedicineExpiryItem(
                MedicineName=medicine.BrandName,
                BatchCode=batch.BatchCode,
                Quantity=batch.Quantity,
                ExpiryDate=batch.ExpiryDate,
                DaysToExpiry=days_to_expiry,
                Status=status,
                SupplierName=supplier_name
            ))
            
    expiry_items.sort(key=lambda x: x.DaysToExpiry)

    # --- 2. Medicine-level (Low Stock & Performance) ---
    subq = select(models.Supplier.Name).select_from(models.PurchaseItem)\
        .join(models.Purchase)\
        .join(models.Supplier)\
        .where(models.PurchaseItem.MedicineId == models.Medicine.MedicineId)\
        .order_by(models.Purchase.PurchaseDate.desc())\
        .limit(1).scalar_subquery()

    q_meds = db.query(
        models.Medicine,
        models.Category,
        subq.label('supplier_name')
    ).outerjoin(models.Category, models.Medicine.CategoryId == models.Category.CategoryId)

    if category_id:
        q_meds = q_meds.filter(models.Medicine.CategoryId == category_id)
    if search:
        q_meds = q_meds.filter(models.Medicine.BrandName.ilike(f"%{search}%"))
        
    medicines_data = q_meds.all()
    
    # 2a. Low Stock
    low_stock_items = []
    active_medicines = set()
    for med, cat, supplier_name in medicines_data:
        current_stock = sum(b.Quantity for b in med.batches if b.Quantity > 0)
        if current_stock > 0:
            active_medicines.add(med.MedicineId)
            
        reorder_level = med.ReorderLevel if med.ReorderLevel and med.ReorderLevel > 0 else low_stock_threshold
        if current_stock <= reorder_level:
            deficit = reorder_level - current_stock
            suggested = max((reorder_level * 2) - current_stock, 0)
            low_stock_items.append(MedicineLowStockItem(
                MedicineName=med.BrandName,
                Category=cat.CategoryName if cat else 'Uncategorized',
                CurrentStock=current_stock,
                ReorderLevel=reorder_level,
                Deficit=deficit,
                SuggestedReorderQty=suggested,
                SupplierName=supplier_name
            ))
            
    low_stock_items.sort(key=lambda x: x.Deficit, reverse=True)

    # 2b. Moving Items
    days_in_range = (end_date - start_date).days if (start_date and end_date) else 30
    if days_in_range <= 0: days_in_range = 1
    
    movement_items = []
    fast_count = 0
    slow_count = 0
    dead_count = 0
    
    q_sales = db.query(
        models.StockBatch.MedicineId.label('medicine_id'),
        func.sum(models.SaleItem.Quantity).label('sold_qty'),
        func.sum(models.SaleItem.TotalPrice).label('revenue')
    ).select_from(models.SaleItem).join(models.Sale).join(models.StockBatch)
    
    if start_date and end_date:
        q_sales = q_sales.filter(
            func.date(models.Sale.TransactionDate, 'localtime') >= start_date,
            func.date(models.Sale.TransactionDate, 'localtime') <= end_date
        )
    
    sales_data = q_sales.group_by(models.StockBatch.MedicineId).all()
    sales_map = {item.medicine_id: {'sold_qty': item.sold_qty, 'revenue': item.revenue} for item in sales_data}
    
    for med, cat, supplier_name in medicines_data:
        stats = sales_map.get(med.MedicineId, {'sold_qty': 0, 'revenue': 0})
        sold_qty = stats['sold_qty'] or 0
        revenue = stats['revenue'] or 0
        
        velocity = float(sold_qty) / days_in_range
        
        classification = 'Normal'
        if sold_qty == 0 and med.MedicineId in active_medicines and days_in_range >= 60:
            classification = 'Dead Stock'
            dead_count += 1
        elif velocity >= 2.0:
            classification = 'Fast Moving'
            fast_count += 1
        elif velocity < 0.5 and med.MedicineId in active_medicines:
            classification = 'Slow Moving'
            slow_count += 1
            
        if classification != 'Normal':
            movement_items.append(MedicineMovementAnalyticsItem(
                MedicineName=med.BrandName,
                Category=cat.CategoryName if cat else 'Uncategorized',
                SoldQuantity=sold_qty,
                SalesVelocity=round(velocity, 2),
                Revenue=float(revenue),
                Classification=classification,
                SupplierName=supplier_name
            ))
            
    movement_items.sort(key=lambda x: x.SalesVelocity, reverse=True)

    summary = MedicineReportSummary(
        TotalExpiredBatches=total_expired,
        ExpiringSoonBatches=expiring_soon,
        LowStockMedicines=len(low_stock_items),
        FastMovingCount=fast_count,
        SlowMovingCount=slow_count,
        DeadStockCount=dead_count
    )

    # --- Pagination ---
    target_list = []
    if report_type == 'expiry':
        target_list = expiry_items
    elif report_type == 'low_stock':
        target_list = low_stock_items
    elif report_type == 'moving':
        target_list = movement_items
    else:
        # Default behavior: return all without pagination
        return MedicineReportResponse(
            summary=summary,
            expiry_items=expiry_items,
            low_stock_items=low_stock_items,
            movement_items=movement_items,
            pagination=None
        )

    total = len(target_list)
    if page_size > 0:
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_list = target_list[start_idx:end_idx]
    else:
        paginated_list = target_list

    pagination_meta = PaginationMetadata(total=total, page=page, page_size=page_size)

    return MedicineReportResponse(
        summary=summary,
        expiry_items=paginated_list if report_type == 'expiry' else [],
        low_stock_items=paginated_list if report_type == 'low_stock' else [],
        movement_items=paginated_list if report_type == 'moving' else [],
        pagination=pagination_meta
    )

@router.get("/medicine", response_model=MedicineReportResponse)
def get_medicine_reports(
    report_type: str = Query(None, description="Type of report: expiry, low_stock, or moving"),
    search: str = Query(None),
    category_id: int = Query(None),
    page: int = Query(1),
    page_size: int = Query(10),
    timeframe: str = Query("last_30_days", description="Timeframe for moving items analysis"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    return fetch_medicine_report_data(db, sd, ed, report_type, search, category_id, page, page_size)

@router.get("/medicine/export/csv")
def export_medicine_report_csv(
    report_type: str = Query(..., description="Type of report: expiry, low_stock, or moving"),
    search: str = Query(None),
    category_id: int = Query(None),
    timeframe: str = Query("last_30_days"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    # Use page_size=0 to fetch all matches without pagination
    data = fetch_medicine_report_data(db, sd, ed, report_type, search, category_id, 1, 0)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "expiry":
        writer.writerow(["Medicine Name", "Batch Code", "Quantity", "Expiry Date", "Days to Expiry", "Supplier", "Status"])
        for item in data.expiry_items:
            writer.writerow([item.MedicineName, item.BatchCode, item.Quantity, item.ExpiryDate.strftime("%Y-%m-%d"), item.DaysToExpiry, item.SupplierName or "", item.Status])
    elif report_type == "low_stock":
        writer.writerow(["Medicine Name", "Category", "Supplier", "Current Stock", "Reorder Level", "Deficit", "Suggested Reorder Qty"])
        for item in data.low_stock_items:
            writer.writerow([item.MedicineName, item.Category, item.SupplierName or "", item.CurrentStock, item.ReorderLevel, item.Deficit, item.SuggestedReorderQty])
    elif report_type == "moving":
        writer.writerow(["Medicine Name", "Category", "Supplier", "Sold Quantity", "Sales Velocity (units/day)", "Revenue", "Classification"])
        for item in data.movement_items:
            writer.writerow([item.MedicineName, item.Category, item.SupplierName or "", item.SoldQuantity, item.SalesVelocity, item.Revenue, item.Classification])
    else:
        return Response(status_code=400, content="Invalid report type")
        
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=medicine_{report_type}_report.csv"
    return response

def fetch_financial_report_data(
    db: Session, 
    start_date: date, 
    end_date: date
):
    # 1. Sales Data (Revenue & Discounts & Returns & COGS)
    completed_sales = db.query(models.Sale).options(selectinload(models.Sale.items)).filter(
        func.date(models.Sale.TransactionDate, 'localtime') >= start_date,
        func.date(models.Sale.TransactionDate, 'localtime') <= end_date,
        ~models.Sale.Status.in_(["Returned", "Fully Refunded", "Cancelled"])
    ).all()
    
    returned_sales = db.query(models.SaleReturn).filter(
        func.date(models.SaleReturn.ReturnDate, 'localtime') >= start_date,
        func.date(models.SaleReturn.ReturnDate, 'localtime') <= end_date
    ).all()
    
    gross_sales = sum(float(s.SubTotal or 0.0) for s in completed_sales)
    discounts_applied = sum(float(s.DiscountAmount or 0.0) for s in completed_sales)
    sales_returns = sum(float(r.TotalRefundAmount or 0.0) for r in returned_sales)
    
    total_revenue = gross_sales - discounts_applied - sales_returns
    
    all_batch_ids = {item.BatchId for sale in completed_sales for item in sale.items}
    batch_costs = {
        batch_id: float(cost or 0.0)
        for batch_id, cost in db.query(models.StockBatch.BatchId, models.StockBatch.CostPrice)
        .filter(models.StockBatch.BatchId.in_(all_batch_ids)).all()
    } if all_batch_ids else {}

    total_cogs = 0.0
    for sale in completed_sales:
        for item in sale.items:
            total_cogs += ((item.Quantity - item.ReturnedQuantity) * batch_costs.get(item.BatchId, 0.0))
                
    # 2. Inventory Loss / Expiry Write-Off
    today = date.today()
    expired_batches = db.query(models.StockBatch).filter(
        models.StockBatch.Quantity > 0,
        models.StockBatch.ExpiryDate < today
    ).all()
    
    inventory_loss = sum((b.Quantity * float(b.CostPrice or 0.0)) for b in expired_batches)
    
    # 3. Profits
    gross_profit = total_revenue - total_cogs
    total_expenses = 0.0  # Operating Expenses set to 0.0 for this phase as proposed
    net_profit = gross_profit - total_expenses - inventory_loss
    
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0.0
    
    summary = FinancialReportSummary(
        GrossSales=gross_sales,
        DiscountsApplied=discounts_applied,
        SalesReturns=sales_returns,
        TotalRevenue=total_revenue,
        TotalCOGS=total_cogs,
        InventoryLoss=inventory_loss,
        GrossProfit=gross_profit,
        TotalExpenses=total_expenses,
        NetProfit=net_profit,
        ProfitMargin=profit_margin
    )
    
    income_breakdown = [
        FinancialBreakdownItem(Category="Sales Revenue (Gross)", Amount=gross_sales)
    ]
    
    expense_breakdown = [
        FinancialBreakdownItem(Category="Cost of Goods Sold", Amount=total_cogs),
        FinancialBreakdownItem(Category="Discounts Applied", Amount=discounts_applied),
        FinancialBreakdownItem(Category="Sales Returns / Refunds", Amount=sales_returns),
        FinancialBreakdownItem(Category="Inventory Loss / Expiry Write-Off", Amount=inventory_loss),
        FinancialBreakdownItem(Category="Operating Expenses", Amount=total_expenses)
    ]
    
    # 4. Trend Data
    days_diff = (end_date - start_date).days
    if days_diff == 0:
        interval = 'hourly'
        fmt = '%H:00'
    elif days_diff > 60:
        interval = 'monthly'
        fmt = '%Y-%m'
    else:
        interval = 'daily'
        fmt = '%Y-%m-%d'

    date_seq = generate_trend_sequence(start_date, end_date, interval)
    trend_dict = {d: {"revenue": 0.0, "expenses": 0.0} for d in date_seq}

    # Add daily revenue
    for s in completed_sales:
        if s.TransactionDate:
            local_dt = s.TransactionDate.replace(tzinfo=timezone.utc).astimezone() if s.TransactionDate.tzinfo is None else s.TransactionDate.astimezone()
            period = local_dt.strftime(fmt)
        else:
            period = ""
        if period in trend_dict:
            # Net revenue for the sale (SubTotal - Discount)
            trend_dict[period]["revenue"] += (float(s.SubTotal or 0.0) - float(s.DiscountAmount or 0.0))
            
            # Add COGS to expenses for the sale
            sale_cogs = sum(i.Quantity * batch_costs.get(i.BatchId, 0.0) for i in s.items)
            trend_dict[period]["expenses"] += sale_cogs
            
    # Add daily returns to expenses (as a reduction of revenue)
    for r in returned_sales:
        if r.ReturnDate:
            local_r_dt = r.ReturnDate.replace(tzinfo=timezone.utc).astimezone() if r.ReturnDate.tzinfo is None else r.ReturnDate.astimezone()
            period = local_r_dt.strftime(fmt)
        else:
            period = ""
        if period in trend_dict:
            trend_dict[period]["expenses"] += float(r.TotalRefundAmount or 0.0)

    # Note: Inventory loss is static (current active expired stock), so we distribute it evenly or just skip it in daily trend? 
    # Skipping it in daily trend because it's a cumulative current loss, not realized on a specific day in this date range.
            
    trend_data = []
    for d in date_seq:
        rev = trend_dict[d]["revenue"]
        exp = trend_dict[d]["expenses"]
        prof = rev - exp
        trend_data.append(FinancialTrendPoint(label=d, revenue=rev, expenses=exp, profit=prof))
        
    return FinancialReportResponse(
        summary=summary,
        income_breakdown=income_breakdown,
        expense_breakdown=expense_breakdown,
        trend_data=trend_data
    )

@router.get("/financial", response_model=FinancialReportResponse)
def get_financial_reports(
    timeframe: str = Query("last_30_days"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    return fetch_financial_report_data(db, sd, ed)


@router.get("/sales/export/excel")
def export_sales_report_excel(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    customer_id: str = None,
    payment_method: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_sales_report_data(db, sd, ed, customer_id, payment_method)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sales Report"
    
    headers = ['Invoice No', 'Date', 'Customer', 'Medicines Sold', 'Total Qty', 'Discount', 'Tax', 'Grand Total', 'Payment Method', 'Status']
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")
    
    for t in report_data.transactions:
        t_dt = t.TransactionDate.astimezone() if t.TransactionDate.tzinfo else t.TransactionDate
        ws.append([
            t.InvoiceNo, 
            t_dt.strftime("%Y-%m-%d %H:%M:%S"),
            t.CustomerName,
            t.MedicinesSold,
            t.TotalQty,
            round(t.Discount, 2),
            round(t.Tax, 2),
            round(t.GrandTotal, 2),
            t.PaymentMethod,
            t.Status
        ])
    
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column].width = adjusted_width
        
    output = io.BytesIO()
    wb.save(output)
    response = Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response.headers["Content-Disposition"] = f"attachment; filename=sales_report_{sd}_to_{ed}.xlsx"
    return response

@router.get("/purchases/export/excel")
def export_purchase_report_excel(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    supplier_id: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_purchase_report_data(db, sd, ed, supplier_id)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Purchase Report"
    
    headers = ['Invoice No', 'Date', 'Supplier', 'Medicines Purchased', 'Total Qty', 'Discount', 'Tax', 'Grand Total', 'Status']
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")
    
    for t in report_data.transactions:
        ws.append([
            t.InvoiceNo, 
            t.PurchaseDate.strftime("%Y-%m-%d %H:%M:%S"),
            t.SupplierName,
            t.MedicinesPurchased,
            t.TotalQty,
            round(t.Discount, 2),
            round(t.Tax, 2),
            round(t.GrandTotal, 2),
            t.Status
        ])
    
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column].width = (max_length + 2)
        
    output = io.BytesIO()
    wb.save(output)
    response = Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response.headers["Content-Disposition"] = f"attachment; filename=purchase_report_{sd}_to_{ed}.xlsx"
    return response

@router.get("/inventory/export/excel")
def export_inventory_report_excel(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_inventory_report_data(db, sd, ed)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inventory Report"
    
    headers = ['Medicine Name', 'Category', 'Batch Number', 'Stock Quantity', 'Cost Price', 'Selling Price', 'Total Cost Value', 'Total Retail Value', 'Expiry Date', 'Status']
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")
    
    for t in report_data.stock_items:
        ws.append([
            t.MedicineName,
            t.Category,
            t.BatchCode,
            t.Quantity,
            round(t.CostPrice, 2),
            round(t.SellingPrice, 2),
            round(t.TotalCostValue, 2),
            round(t.TotalRetailValue, 2),
            t.ExpiryDate.strftime("%Y-%m-%d") if getattr(t, 'ExpiryDate', None) else "N/A",
            t.Status
        ])
        
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column].width = (max_length + 2)
        
    output = io.BytesIO()
    wb.save(output)
    response = Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response.headers["Content-Disposition"] = f"attachment; filename=inventory_report.xlsx"
    return response

@router.get("/medicine/export/excel")
def export_medicine_report_excel(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    report_type: str = 'expiry',
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_medicine_report_data(db, sd, ed)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Medicine {report_type.capitalize()} Report"
    
    if report_type == 'expiry':
        headers = ['Brand Name', 'Batch Number', 'Stock Qty', 'Expiry Date', 'Days to Expire', 'Status']
    elif report_type == 'low_stock':
        headers = ['Brand Name', 'Current Stock', 'Min Stock Level', 'Suggested Reorder Qty', 'Status']
    else:
        headers = ['Brand Name', 'Total Qty Sold', 'Total Revenue', 'Avg Daily Sales', 'Classification']

    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")

    if report_type == 'expiry':
        items = report_data.expiry_items
    elif report_type == 'low_stock':
        items = report_data.low_stock_items
    else:
        items = report_data.movement_items

    for t in items:
        if report_type == 'expiry':
            ws.append([t.MedicineName, t.BatchCode, t.Quantity, t.ExpiryDate.strftime("%Y-%m-%d") if t.ExpiryDate else 'N/A', t.DaysToExpiry, t.Status])
        elif report_type == 'low_stock':
            ws.append([t.MedicineName, t.CurrentStock, t.ReorderLevel, t.SuggestedReorderQty, 'Low Stock'])
        else:
            ws.append([t.MedicineName, t.SoldQuantity, round(t.Revenue, 2), round(t.SalesVelocity, 2), t.Classification])
            
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column].width = (max_length + 2)
        
    output = io.BytesIO()
    wb.save(output)
    response = Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response.headers["Content-Disposition"] = f"attachment; filename=medicine_{report_type}_report.xlsx"
    return response

@router.get("/financial/export/excel")
def export_financial_report_excel(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_financial_report_data(db, sd, ed)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Financial Report"
    
    headers = ['Category', 'Amount', 'Type']
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")
    
    for item in report_data.income_breakdown:
        ws.append([item.Category, round(item.Amount, 2), "Income"])
    for item in report_data.expense_breakdown:
        ws.append([item.Category, round(item.Amount, 2), "Expense"])
        
    ws.append([])
    ws.append(["Summary", "Amount"])
    ws.append(["Total Revenue", round(report_data.summary.TotalRevenue, 2)])
    ws.append(["Total COGS", round(report_data.summary.TotalCOGS, 2)])
    ws.append(["Gross Profit", round(report_data.summary.GrossProfit, 2)])
    ws.append(["Total Expenses", round(report_data.summary.TotalExpenses, 2)])
    ws.append(["Net Profit", round(report_data.summary.NetProfit, 2)])
    ws.append(["Profit Margin", f"{round(report_data.summary.ProfitMargin, 2)}%"])
    
    for row in ws.iter_rows(min_row=len(report_data.income_breakdown) + len(report_data.expense_breakdown) + 3, max_row=len(report_data.income_breakdown) + len(report_data.expense_breakdown) + 8):
        row[0].font = Font(bold=True)
        
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column].width = (max_length + 2)
        
    output = io.BytesIO()
    wb.save(output)
    response = Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response.headers["Content-Disposition"] = f"attachment; filename=financial_report.xlsx"
    return response




# ═══════════════════════════════════════════════════════════════════════════════
#  Shared PDF Design System — used by all 5 report types
# ═══════════════════════════════════════════════════════════════════════════════

# ── Colour palette ────────────────────────────────────────────────────────────
C_DARK      = colors.HexColor('#0F172A')   # slate-900  – header bar, table header
C_MID       = colors.HexColor('#334155')   # slate-700  – section titles
C_BODY      = colors.HexColor('#1E293B')   # slate-800  – body text
C_MUTED     = colors.HexColor('#64748B')   # slate-500  – meta / captions
C_RULE      = colors.HexColor('#E2E8F0')   # slate-200  – dividers / grid
C_ROW_ALT   = colors.HexColor('#F8FAFC')   # slate-50   – alternating row
C_ACCENT    = colors.HexColor('#3B82F6')   # blue-500   – badge / highlight
C_WHITE     = colors.white
C_SUCCESS   = colors.HexColor('#16A34A')   # green-700
C_DANGER    = colors.HexColor('#DC2626')   # red-600

# ── Page geometry (A4 portrait) ───────────────────────────────────────────────
PAGE_W, PAGE_H = A4          # 595.27 x 841.89 pt
MARGIN_L = MARGIN_R = 36     # 36 pt = 0.5 inch side margins
MARGIN_TOP   = 96            # sits just below the 80 pt header bar
MARGIN_BOTTOM = 58           # room for footer text at ~34 pt from bottom
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R   # ≈ 523 pt usable width


def _new_doc(output):
    """Create a consistently configured SimpleDocTemplate for all reports."""
    return SimpleDocTemplate(
        output, pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        invariant=1,
    )


# ── Paragraph styles ──────────────────────────────────────────────────────────
def _styles():
    """Return a dict of named ParagraphStyles."""
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('RPT_Title', fontName='Helvetica-Bold', fontSize=20,
                                textColor=C_DARK, spaceAfter=3, spaceBefore=0, leading=24),
        'subtitle': ParagraphStyle('RPT_Sub', fontName='Helvetica', fontSize=8.5,
                                   textColor=C_MUTED, spaceAfter=0, leading=13),
        'section': ParagraphStyle('RPT_Section', fontName='Helvetica-Bold', fontSize=9,
                                  textColor=C_MID, spaceAfter=5, spaceBefore=0,
                                  textTransform='uppercase', letterSpacing=0.5),
        'kpi_label': ParagraphStyle('RPT_KL', fontName='Helvetica-Bold', fontSize=8.5,
                                    textColor=C_MUTED, leading=11),
        'kpi_value': ParagraphStyle('RPT_KV', fontName='Helvetica-Bold', fontSize=10,
                                    textColor=C_DARK, alignment=TA_RIGHT, leading=13),
        'cell':      ParagraphStyle('RPT_Cell', fontName='Helvetica', fontSize=8,
                                    textColor=C_BODY, leading=10),
        'cell_bold': ParagraphStyle('RPT_CellB', fontName='Helvetica-Bold', fontSize=8,
                                    textColor=C_DARK, leading=10),
        'footnote':  ParagraphStyle('RPT_Foot', fontName='Helvetica', fontSize=7.5,
                                    textColor=C_MUTED, spaceAfter=0),
    }


# ── Canvas callbacks ──────────────────────────────────────────────────────────
def _make_page_callbacks(pharmacy_name: str, badge_label: str, report_title: str):
    """Return (onFirstPage, onLaterPages) that draw the header bar and footer."""

    def _on_page(canvas, doc):
        canvas.saveState()
        # ── Header bar ────────────────────────────────────────────────────────
        bar_h = 80
        canvas.setFillColor(C_DARK)
        canvas.rect(0, PAGE_H - bar_h, PAGE_W, bar_h, fill=1, stroke=0)

        # Pharmacy name — left
        canvas.setFont('Helvetica-Bold', 12)
        canvas.setFillColor(C_WHITE)
        canvas.drawString(MARGIN_L, PAGE_H - bar_h + 36, pharmacy_name)

        # Badge — right
        canvas.setFont('Helvetica-Bold', 7)
        badge_text = badge_label.upper()
        bw = canvas.stringWidth(badge_text, 'Helvetica-Bold', 7) + 16
        bx = PAGE_W - MARGIN_R - bw
        by = PAGE_H - bar_h + 30
        canvas.setFillColor(C_ACCENT)
        canvas.roundRect(bx, by, bw, 16, 3, fill=1, stroke=0)
        canvas.setFillColor(C_WHITE)
        canvas.drawString(bx + 8, by + 4.5, badge_text)

        # ── Footer ────────────────────────────────────────────────────────────
        canvas.setStrokeColor(C_RULE)
        canvas.setLineWidth(0.4)
        canvas.line(MARGIN_L, 46, PAGE_W - MARGIN_R, 46)

        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(C_MUTED)
        canvas.drawString(MARGIN_L, 32, f"{pharmacy_name}  ·  {report_title}")
        canvas.drawRightString(PAGE_W - MARGIN_R, 32, f"Page {doc.page}")

        canvas.restoreState()

    return _on_page, _on_page


# ── Separator rule ────────────────────────────────────────────────────────────
def _rule(width=None):
    w = width or CONTENT_W
    t = Table([['']], colWidths=[w], rowHeights=[0.4],
              style=TableStyle([
                  ('LINEABOVE', (0, 0), (-1, -1), 0.4, C_RULE),
                  ('TOPPADDING',    (0, 0), (-1, -1), 0),
                  ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
              ]))
    return t


# ── In-flow header block ──────────────────────────────────────────────────────
def build_pdf_header(title_text: str, date_range_str: str,
                     pharmacy_name: str = 'Pharmacy', logo_path=None):
    """Flowable elements: report title + date range + generated timestamp + rule."""
    st = _styles()
    now = _get_now_str()
    return [
        Spacer(1, 8),
        Paragraph(title_text, st['title']),
        Paragraph(f"{date_range_str}   ·   Generated: {now}", st['subtitle']),
        Spacer(1, 8),
        _rule(),
        Spacer(1, 10),
    ]


# ── KPI summary grid ──────────────────────────────────────────────────────────
def build_report_summary(kpi_pairs: list):
    """
    Build a compact 2-column KPI grid.
    kpi_pairs: list of (label_str, value_str) tuples.
    """
    st = _styles()
    if not kpi_pairs:
        return []

    # Arrange into rows of 2 KPIs each (4 cells: label, value, label, value)
    col_w = CONTENT_W / 2           # each KPI column half the page width
    cell_w = col_w / 2              # label + value split 50/50

    rows = []
    for i in range(0, len(kpi_pairs), 2):
        left  = kpi_pairs[i]
        right = kpi_pairs[i + 1] if i + 1 < len(kpi_pairs) else ('', '')
        rows.append([
            Paragraph(left[0],  st['kpi_label']),
            Paragraph(left[1],  st['kpi_value']),
            Paragraph(right[0], st['kpi_label']),
            Paragraph(right[1], st['kpi_value']),
        ])

    tbl = Table(rows, colWidths=[cell_w * 1.15, cell_w * 0.85,
                                  cell_w * 1.15, cell_w * 0.85],
                repeatRows=0)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_ROW_ALT),
        ('BOX',        (0, 0), (-1, -1), 0.5, C_RULE),
        ('INNERGRID',  (0, 0), (-1, -1), 0.3, C_RULE),
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        # Right-align value columns
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
    ]))

    return [
        Paragraph('KEY METRICS', st['section']),
        tbl,
        Spacer(1, 12),
    ]


# ── Main data table style ─────────────────────────────────────────────────────
def get_premium_table_style():
    """Shared table style: dark header, zebra rows, clean grid."""
    return TableStyle([
        # Header row
        ('BACKGROUND',    (0, 0), (-1, 0), C_DARK),
        ('TEXTCOLOR',     (0, 0), (-1, 0), C_WHITE),
        ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0), 8),
        ('TOPPADDING',    (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('ALIGN',         (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN',        (0, 0), (-1, 0), 'MIDDLE'),
        # Body rows — zebra
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_ROW_ALT]),
        ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',      (0, 1), (-1, -1), 8),
        ('TEXTCOLOR',     (0, 1), (-1, -1), C_BODY),
        ('TOPPADDING',    (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('ALIGN',         (0, 1), (-1, -1), 'CENTER'),
        ('VALIGN',        (0, 1), (-1, -1), 'MIDDLE'),
        # Grid
        ('INNERGRID', (0, 0), (-1, -1), 0.3, C_RULE),
        ('BOX',       (0, 0), (-1, -1), 0.6, C_RULE),
        ('LINEBELOW', (0, 0), (-1, 0),  1.2, C_ACCENT),
    ])


# ── Paragraph helpers for table cells ────────────────────────────────────────
def _P(text, bold=False):
    """Wrap text in a left-aligned cell Paragraph, XML-escaping the content."""
    import xml.sax.saxutils as _sax
    st = _styles()
    style = st['cell_bold'] if bold else st['cell']
    safe = _sax.escape(str(text)) if text is not None else '-'
    return Paragraph(safe, style)


# ── Chart embed ───────────────────────────────────────────────────────────────
def embed_chart_in_pdf(elements, chart_image_b64):
    if not chart_image_b64:
        return
    try:
        if ',' in chart_image_b64:
            chart_image_b64 = chart_image_b64.split(',')[1]
        img_data = base64.b64decode(chart_image_b64)
        img_buf = io.BytesIO(img_data)
        img = RLImage(img_buf)
        aspect = img.imageHeight / float(img.imageWidth)
        target_w = min(CONTENT_W, img.imageWidth)
        target_h = target_w * aspect
        if target_h > 220:
            target_h = 220
            target_w = target_h / aspect
        img.drawWidth = target_w
        img.drawHeight = target_h

        elements.append(Paragraph('CHART', _styles()['section']))
        elements.append(img)
        elements.append(Spacer(1, 14))
    except Exception as e:
        print('Chart embed failed:', e)


# ── Section divider label ─────────────────────────────────────────────────────
def _section_label(text):
    return [Paragraph(text.upper(), _styles()['section'])]


# ═══════════════════════════════════════════════════════════════════════════════
#  PDF Export Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/sales/export/pdf")
def export_sales_report_pdf(req: dict = Body(...), db: Session = Depends(get_db)):
    req = PDFExportRequest(**req)
    sd, ed = get_reports_date_range(req.timeframe, req.start_date, req.end_date)
    profile = db.query(models.PrinterSettings).first()
    pharmacy_name = profile.PharmacyName if profile else "Pharmacy"
    report_data = fetch_sales_report_data(db, sd, ed, req.customer_id, req.payment_method)
    s = report_data.summary

    output = io.BytesIO()
    doc = _new_doc(output)
    elements = []

    # Header
    date_str = f"{sd.strftime('%d %b %Y')} – {ed.strftime('%d %b %Y')}"
    elements.extend(build_pdf_header("Sales Report", date_str, pharmacy_name))

    # KPIs
    kpis = [
        ("Gross Sales",    f"Rs. {int(round(s.TotalGrossSales)):,}"),
        ("Returns",        f"Rs. {int(round(s.TotalReturns)):,}"),
        ("Net Sales",      f"Rs. {int(round(s.NetSales)):,}"),
        ("Net Profit",     f"Rs. {int(round(s.NetProfit)):,}"),
        ("Profit Margin",  f"{round(s.ProfitMarginPercent, 2)}%"),
        ("Total Invoices", str(s.TotalInvoices)),
        ("Avg Sale Value", f"Rs. {int(round(s.AverageSale)):,}"),
    ]
    elements.extend(build_report_summary(kpis))

    # Chart
    embed_chart_in_pdf(elements, req.chart_image)

    # Table
    # Usable width ≈ 523pt → cols sum must equal that
    # S.No=28, Invoice=68, Date=92, Customer=120, Qty=42, Items=42, Total=72, Status=59 → 523
    elements.extend(_section_label("Transactions"))
    hdrs = ['#', 'Invoice No', 'Date & Time', 'Customer', 'Qty', 'Items', 'Total (Rs)', 'Status']
    rows = [hdrs]
    for i, t in enumerate(report_data.transactions, 1):
        t_dt = t.TransactionDate.astimezone() if t.TransactionDate.tzinfo else t.TransactionDate
        rows.append([
            str(i),
            t.InvoiceNo,
            t_dt.strftime("%d-%m-%Y %I:%M %p"),
            _P(t.CustomerName or 'Walk-in'),
            str(t.TotalQty),
            str(t.MedicinesSold),
            f"{int(round(t.GrandTotal)):,}",
            t.Status,
        ])
    if len(rows) == 1:
        rows.append(['—', '—', '—', _P('No transactions in this period'), '—', '—', '—', '—'])

    tbl = Table(rows, repeatRows=1, colWidths=[28, 68, 92, 120, 42, 42, 72, 59])
    style = get_premium_table_style()
    style.add('ALIGN', (4, 1), (6, -1), 'RIGHT')   # qty/total right-aligned
    tbl.setStyle(style)
    elements.append(tbl)

    on_fp, on_lp = _make_page_callbacks(pharmacy_name, "SALES REPORT", "Sales Report")
    doc.build(elements, onFirstPage=on_fp, onLaterPages=on_lp)
    resp = Response(content=output.getvalue(), media_type="application/pdf")
    resp.headers["Content-Disposition"] = f"attachment; filename=sales_report_{sd}_to_{ed}.pdf"
    return resp


@router.post("/purchases/export/pdf")
def export_purchase_report_pdf(req: dict = Body(...), db: Session = Depends(get_db)):
    req = PDFExportRequest(**req)
    sd, ed = get_reports_date_range(req.timeframe, req.start_date, req.end_date)
    profile = db.query(models.PrinterSettings).first()
    pharmacy_name = profile.PharmacyName if profile else "Pharmacy"
    report_data = fetch_purchase_report_data(db, sd, ed, req.supplier_id)
    s = report_data.summary

    output = io.BytesIO()
    doc = _new_doc(output)
    elements = []

    date_str = f"{sd.strftime('%d %b %Y')} – {ed.strftime('%d %b %Y')}"
    elements.extend(build_pdf_header("Purchase Report", date_str, pharmacy_name))

    kpis = [
        ("Gross Purchases", f"Rs. {int(round(s.TotalGrossPurchases)):,}"),
        ("Returns",         f"Rs. {int(round(s.TotalReturns)):,}"),
        ("Net Purchases",   f"Rs. {int(round(s.NetPurchases)):,}"),
        ("Total Invoices",  str(s.TotalInvoices)),
    ]
    elements.extend(build_report_summary(kpis))

    embed_chart_in_pdf(elements, req.chart_image)

    # #=28 Invoice=68 Date=92 Supplier=130 Items=40 Qty=40 Total=68 Status=57 → 523
    elements.extend(_section_label("Transactions"))
    hdrs = ['#', 'Invoice No', 'Date & Time', 'Supplier', 'Items', 'Qty', 'Total (Rs)', 'Status']
    rows = [hdrs]
    for i, t in enumerate(report_data.transactions, 1):
        rows.append([
            str(i),
            t.InvoiceNo,
            t.PurchaseDate.strftime("%d-%m-%Y %I:%M %p"),
            _P(t.SupplierName),
            str(t.MedicinesPurchased),
            str(t.TotalQty),
            f"{int(round(t.GrandTotal)):,}",
            t.Status,
        ])
    if len(rows) == 1:
        rows.append(['—', '—', '—', _P('No purchases in this period'), '—', '—', '—', '—'])

    tbl = Table(rows, repeatRows=1, colWidths=[28, 68, 92, 130, 40, 40, 68, 57])
    style = get_premium_table_style()
    style.add('ALIGN', (4, 1), (6, -1), 'RIGHT')
    tbl.setStyle(style)
    elements.append(tbl)

    on_fp, on_lp = _make_page_callbacks(pharmacy_name, "PURCHASE REPORT", "Purchase Report")
    doc.build(elements, onFirstPage=on_fp, onLaterPages=on_lp)
    resp = Response(content=output.getvalue(), media_type="application/pdf")
    resp.headers["Content-Disposition"] = f"attachment; filename=purchase_report_{sd}_to_{ed}.pdf"
    return resp


@router.post("/inventory/export/pdf")
def export_inventory_report_pdf(req: dict = Body(...), db: Session = Depends(get_db)):
    req = PDFExportRequest(**req)
    sd, ed = get_reports_date_range(req.timeframe, req.start_date, req.end_date)
    profile = db.query(models.PrinterSettings).first()
    pharmacy_name = profile.PharmacyName if profile else "Pharmacy"
    report_data = fetch_inventory_report_data(db, sd, ed)
    s = report_data.summary

    output = io.BytesIO()
    doc = _new_doc(output)
    elements = []

    date_str = f"{sd.strftime('%d %b %Y')} – {ed.strftime('%d %b %Y')}"
    elements.extend(build_pdf_header("Inventory Report", date_str, pharmacy_name))

    kpis = [
        ("Total Stock Value",    f"Rs. {int(round(s.TotalCostValue)):,}"),
        ("Total Retail Value",   f"Rs. {int(round(s.TotalRetailValue)):,}"),
        ("Expired / Write-offs", f"Rs. {int(round(s.ExpiredWrittenOffValuation)):,}"),
        ("Total Units in Stock", f"{int(round(s.TotalItemsInStock)):,}"),
        ("Low Stock",            str(s.LowStockCount)),
        ("Out of Stock",         str(s.OutOfStockCount)),
    ]
    elements.extend(build_report_summary(kpis))

    embed_chart_in_pdf(elements, req.chart_image)

    # #=28 Medicine=140 Category=85 Batch=55 Qty=40 Cost=52 Selling=57 Status=66 → 523
    elements.extend(_section_label("Stock Items"))
    hdrs = ['#', 'Medicine Name', 'Category', 'Batch', 'Qty', 'Cost (Rs)', 'Sell (Rs)', 'Status']
    rows = [hdrs]
    for i, t in enumerate(report_data.stock_items[:200], 1):
        rows.append([
            str(i),
            _P(t.MedicineName),
            _P(t.Category),
            t.BatchCode,
            str(t.Quantity),
            f"{int(round(t.CostPrice)):,}",
            f"{int(round(t.SellingPrice)):,}",
            t.Status,
        ])
    if len(rows) == 1:
        rows.append(['—', _P('No stock items found'), '—', '—', '—', '—', '—', '—'])

    tbl = Table(rows, repeatRows=1, colWidths=[28, 140, 85, 55, 40, 52, 57, 66])
    style = get_premium_table_style()
    style.add('ALIGN', (1, 1), (2, -1), 'LEFT')   # medicine/category left
    style.add('ALIGN', (4, 1), (6, -1), 'RIGHT')  # qty/prices right
    tbl.setStyle(style)
    elements.append(tbl)

    if len(report_data.stock_items) > 200:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(
            f"Showing first 200 of {len(report_data.stock_items)} records. Export to Excel for the complete list.",
            _styles()['footnote']))

    on_fp, on_lp = _make_page_callbacks(pharmacy_name, "INVENTORY REPORT", "Inventory Report")
    doc.build(elements, onFirstPage=on_fp, onLaterPages=on_lp)
    resp = Response(content=output.getvalue(), media_type="application/pdf")
    resp.headers["Content-Disposition"] = "attachment; filename=inventory_report.pdf"
    return resp


@router.post("/medicine/export/pdf")
def export_medicine_report_pdf(req: dict = Body(...), db: Session = Depends(get_db)):
    req = PDFExportRequest(**req)
    sd, ed = get_reports_date_range(req.timeframe, req.start_date, req.end_date)
    report_data = fetch_medicine_report_data(db, sd, ed, req.report_type, None, None, 1, 0)
    profile = db.query(models.PrinterSettings).first()
    pharmacy_name = profile.PharmacyName if profile else "Pharmacy"

    output = io.BytesIO()
    doc = _new_doc(output)
    elements = []
    st = _styles()

    title_map = {
        'expiry':    'Medicine Expiry Alerts',
        'low_stock': 'Medicine Low Stock Report',
        'moving':    'Medicine Performance Report',
    }
    report_title = title_map.get(req.report_type, "Medicine Report")

    date_str = f"{sd.strftime('%d %b %Y')} – {ed.strftime('%d %b %Y')}"
    elements.extend(build_pdf_header(report_title, date_str, pharmacy_name))

    kpis = [
        ("Expired Batches",    str(report_data.summary.TotalExpiredBatches)),
        ("Expiring Soon (90d)", str(report_data.summary.ExpiringSoonBatches)),
        ("Low Stock Items",    str(report_data.summary.LowStockMedicines)),
        ("Fast Moving",        str(report_data.summary.FastMovingCount)),
    ]
    elements.extend(build_report_summary(kpis))
    embed_chart_in_pdf(elements, req.chart_image)
    elements.extend(_section_label("Detail"))

    if req.report_type == 'expiry':
        # #=28 Medicine=140 Batch=65 Supplier=110 Qty=38 Expiry=68 Days=36 Status=38 → 523
        hdrs = ['#', 'Medicine', 'Batch', 'Supplier', 'Qty', 'Expiry Date', 'Days', 'Status']
        cw = [28, 140, 65, 110, 38, 68, 36, 38]
        rows = [hdrs]
        for i, t in enumerate(report_data.expiry_items[:200], 1):
            rows.append([
                str(i),
                _P(t.MedicineName),
                _P(t.BatchCode),
                _P(getattr(t, 'SupplierName', None) or '—'),
                str(t.Quantity),
                t.ExpiryDate.strftime("%d-%m-%Y") if t.ExpiryDate else '—',
                str(t.DaysToExpiry),
                _P(t.Status),
            ])
        truncated = len(report_data.expiry_items) > 200

    elif req.report_type == 'low_stock':
        # #=28 Medicine=140 Category=90 Supplier=95 Stock=40 Reorder=52 Deficit=40 Sugg=38 → 523
        hdrs = ['#', 'Medicine', 'Category', 'Supplier', 'Stock', 'Reorder Lvl', 'Deficit', 'Sugg Qty']
        cw = [28, 140, 90, 95, 40, 52, 40, 38]
        rows = [hdrs]
        for i, t in enumerate(report_data.low_stock_items[:200], 1):
            rows.append([
                str(i),
                _P(t.MedicineName),
                _P(t.Category),
                _P(getattr(t, 'SupplierName', None) or '—'),
                str(getattr(t, 'CurrentStock', 0)),
                str(getattr(t, 'ReorderLevel', 0)),
                str(getattr(t, 'Deficit', 0)),
                str(getattr(t, 'SuggestedReorderQty', 0)),
            ])
        truncated = len(report_data.low_stock_items) > 200

    else:  # moving / performance
        # #=28 Medicine=160 Category=100 Sold=50 Velocity=55 Revenue=72 Class=58 → 523
        hdrs = ['#', 'Medicine', 'Category', 'Sold', 'Velocity', 'Revenue (Rs)', 'Class']
        cw = [28, 160, 100, 50, 55, 72, 58]
        rows = [hdrs]
        for i, t in enumerate(report_data.movement_items[:200], 1):
            rows.append([
                str(i),
                _P(t.MedicineName),
                _P(t.Category),
                str(getattr(t, 'SoldQuantity', 0)),
                str(round(getattr(t, 'SalesVelocity', 0.0), 2)),
                f"{int(round(getattr(t, 'Revenue', 0.0))):,}",
                _P(getattr(t, 'Classification', '—')),
            ])
        truncated = len(report_data.movement_items) > 200

    if len(rows) == 1:
        rows.append(['—'] + [_P('No data available')] + ['—'] * (len(hdrs) - 2))

    tbl = Table(rows, repeatRows=1, colWidths=cw)
    style = get_premium_table_style()
    style.add('ALIGN', (1, 1), (2, -1), 'LEFT')
    tbl.setStyle(style)
    elements.append(tbl)

    if truncated:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(
            "Showing first 200 records. Export to CSV for the complete list.",
            st['footnote']))

    on_fp, on_lp = _make_page_callbacks(pharmacy_name, "MEDICINE REPORT", report_title)
    doc.build(elements, onFirstPage=on_fp, onLaterPages=on_lp)
    resp = Response(content=output.getvalue(), media_type="application/pdf")
    resp.headers["Content-Disposition"] = f"attachment; filename=medicine_{req.report_type}_report.pdf"
    return resp


@router.post("/financial/export/pdf")
def export_financial_report_pdf(req: dict = Body(...), db: Session = Depends(get_db)):
    req = PDFExportRequest(**req)
    sd, ed = get_reports_date_range(req.timeframe, req.start_date, req.end_date)
    profile = db.query(models.PrinterSettings).first()
    pharmacy_name = profile.PharmacyName if profile else "Pharmacy"
    report_data = fetch_financial_report_data(db, sd, ed)
    s = report_data.summary

    output = io.BytesIO()
    doc = _new_doc(output)
    elements = []
    st = _styles()

    date_str = f"{sd.strftime('%d %b %Y')} – {ed.strftime('%d %b %Y')}"
    elements.extend(build_pdf_header("Profit & Loss Statement", date_str, pharmacy_name))

    kpis = [
        ("Total Revenue",       f"Rs. {int(round(s.TotalRevenue)):,}"),
        ("Cost of Goods Sold",  f"Rs. {int(round(s.TotalCOGS)):,}"),
        ("Gross Profit",        f"Rs. {int(round(s.GrossProfit)):,}"),
        ("Total Expenses",      f"Rs. {int(round(s.TotalExpenses)):,}"),
        ("Net Profit / Loss",   f"Rs. {int(round(s.NetProfit)):,}"),
        ("Profit Margin",       f"{round(s.ProfitMargin, 2)}%"),
    ]
    elements.extend(build_report_summary(kpis))
    embed_chart_in_pdf(elements, req.chart_image)
    elements.extend(_section_label("Statement of Operations"))

    # Financial P&L table — full width, 3 cols
    # Description=280  Amount=130  Section=113 → 523
    hdrs = ['Description', 'Amount (Rs)', 'Section']
    rows = [
        hdrs,
        ["Gross Sales Revenue",        f"Rs. {int(round(s.GrossSales)):,}",          "Revenue"],
        ["Less: Sales Returns & Refunds", f"(Rs. {int(round(s.SalesReturns)):,})",   "Revenue"],
        ["Less: Discounts Given",      f"(Rs. {int(round(s.DiscountsApplied)):,})",   "Revenue"],
        [_P("Subtotal: Net Revenue", bold=True),
         _P(f"Rs. {int(round(s.TotalRevenue)):,}", bold=True),
         _P("Revenue", bold=True)],

        ["Direct Cost of Sold Medicines", f"(Rs. {int(round(s.TotalCOGS)):,})",      "COGS"],
        [_P("Subtotal: Gross Profit", bold=True),
         _P(f"Rs. {int(round(s.GrossProfit)):,}", bold=True),
         _P("COGS", bold=True)],

        ["Inventory Expiry & Write-Offs", f"(Rs. {int(round(s.InventoryLoss)):,})",  "Expenses"],
        ["Operating Expenses",           f"(Rs. {int(round(s.TotalExpenses)):,})",   "Expenses"],
    ]

    # Final net profit row — highlighted
    net_positive = s.NetProfit >= 0
    rows.append([
        Paragraph("NET PROFIT / LOSS",
                  ParagraphStyle('NPL', fontName='Helvetica-Bold', fontSize=10,
                                 textColor=C_SUCCESS if net_positive else C_DANGER)),
        Paragraph(f"Rs. {int(round(s.NetProfit)):,}",
                  ParagraphStyle('NPLV', fontName='Helvetica-Bold', fontSize=10,
                                 textColor=C_SUCCESS if net_positive else C_DANGER,
                                 alignment=TA_RIGHT)),
        Paragraph("Final Summary",
                  ParagraphStyle('NPLS', fontName='Helvetica-Bold', fontSize=10,
                                 textColor=C_MID)),
    ])

    tbl = Table(rows, repeatRows=1, colWidths=[280, 130, 113])
    style = get_premium_table_style()
    # Left-align description and section cols
    style.add('ALIGN', (0, 1), (0, -1), 'LEFT')
    style.add('ALIGN', (2, 1), (2, -1), 'LEFT')
    # Right-align amount col
    style.add('ALIGN', (1, 1), (1, -1), 'RIGHT')
    # Subtotal rows bold background tint
    for bold_row in [4, 6]:
        style.add('BACKGROUND', (0, bold_row), (-1, bold_row), colors.HexColor('#EFF6FF'))
    # Net profit/loss row highlight
    style.add('BACKGROUND', (0, len(rows) - 1), (-1, len(rows) - 1),
              colors.HexColor('#DCFCE7') if net_positive else colors.HexColor('#FEE2E2'))
    style.add('LINEABOVE', (0, len(rows) - 1), (-1, len(rows) - 1), 1.2, C_ACCENT)
    tbl.setStyle(style)
    elements.append(tbl)

    on_fp, on_lp = _make_page_callbacks(pharmacy_name, "FINANCIAL REPORT", "Profit & Loss Statement")
    doc.build(elements, onFirstPage=on_fp, onLaterPages=on_lp)
    resp = Response(content=output.getvalue(), media_type="application/pdf")
    resp.headers["Content-Disposition"] = "attachment; filename=financial_report.pdf"
    return resp









@router.get("/financial/export/csv")
def export_financial_report_csv(
    timeframe: str = 'this_month',
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    sd, ed = get_reports_date_range(timeframe, start_date, end_date)
    report_data = fetch_financial_report_data(db, sd, ed)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Category', 'Amount', 'Type'])
    
    for item in report_data.income_breakdown:
        writer.writerow([item.Category, round(item.Amount, 2), 'Income'])
    for item in report_data.expense_breakdown:
        writer.writerow([item.Category, round(item.Amount, 2), 'Expense'])
        
    writer.writerow([])
    writer.writerow(['Summary', 'Amount'])
    writer.writerow(['Total Revenue', round(report_data.summary.TotalRevenue, 2)])
    writer.writerow(['Total COGS', round(report_data.summary.TotalCOGS, 2)])
    writer.writerow(['Gross Profit', round(report_data.summary.GrossProfit, 2)])
    writer.writerow(['Operating Expenses', round(report_data.summary.TotalExpenses, 2)])
    writer.writerow(['Net Profit', round(report_data.summary.NetProfit, 2)])
    writer.writerow(['Profit Margin', f'{round(report_data.summary.ProfitMargin, 2)}%'])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=financial_report.csv"
    return response
