from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta, datetime
import csv
import io

from api.deps import get_db
import models
from schemas.reports import (
    SalesReportResponse, SalesReportSummary, SalesTransaction, SalesTrendPoint, PaymentMethodStats, TopMedicineStats,
    PurchaseReportResponse, PurchaseReportSummary, PurchaseTransaction, PurchaseTrendPoint, SupplierStats, TopPurchasedMedicineStats
)

router = APIRouter()

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
        func.date(models.Sale.TransactionDate) >= start_date,
        func.date(models.Sale.TransactionDate) <= end_date
    )
    if customer_id and customer_id != "all":
        base_query = base_query.filter(models.Sale.CustomerId == customer_id)
    if payment_method and payment_method != "all":
        base_query = base_query.filter(models.Sale.PaymentMethod == payment_method)

    completed_sales = base_query.filter(models.Sale.Status == 'Completed').all()
    # Assuming Sales Returns/Refunds are marked as 'Returned' or tracked elsewhere. 
    # For now, let's say 'Returned' status means full return.
    returned_sales = base_query.filter(models.Sale.Status == 'Returned').all()

    total_gross_sales = sum(float(s.GrandTotal or 0.0) for s in completed_sales)
    total_returns = sum(float(s.GrandTotal or 0.0) for s in returned_sales)
    net_sales = total_gross_sales - total_returns

    # Calculate COGS dynamically
    total_cogs = 0
    for sale in completed_sales:
        for item in sale.items:
            # item.BatchId -> get batch
            batch = db.query(models.StockBatch).filter(models.StockBatch.BatchId == item.BatchId).first()
            if batch:
                total_cogs += (item.Quantity * float(batch.CostPrice or 0.0))

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
        customer_name = s.customer.FirstName + " " + s.customer.LastName if s.customer else "Walk-in"
        total_qty = sum(i.Quantity for i in s.items)
        transactions.append(SalesTransaction(
            InvoiceNo=s.InvoiceNumber or str(s.SalesId),
            TransactionDate=s.TransactionDate,
            CustomerName=customer_name,
            MedicinesSold=len(s.items),
            TotalQty=total_qty,
            Discount=s.DiscountAmount,
            Tax=s.TaxAmount,
            GrandTotal=float(s.GrandTotal or 0.0),
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
        period = s.TransactionDate.strftime(fmt)
        if period in trend_dict:
            trend_dict[period]["sales"] += float(s.GrandTotal or 0.0)
            sale_cogs = sum((i.Quantity * float(db.query(models.StockBatch).filter(models.StockBatch.BatchId == i.BatchId).first().CostPrice if db.query(models.StockBatch).filter(models.StockBatch.BatchId == i.BatchId).first() else 0.0)) for i in s.items)
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

    # Top Medicines
    med_dict = {}
    for s in completed_sales:
        for i in s.items:
            batch = db.query(models.StockBatch).filter(models.StockBatch.BatchId == i.BatchId).first()
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
        writer.writerow([
            t.InvoiceNo, 
            t.TransactionDate.strftime("%Y-%m-%d %H:%M:%S"),
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
        func.date(models.Purchase.PurchaseDate) >= start_date,
        func.date(models.Purchase.PurchaseDate) <= end_date
    )
    if supplier_id and supplier_id != "all":
        base_query = base_query.filter(models.Purchase.SupplierId == supplier_id)

    completed_purchases = base_query.all()
    # Assuming Purchase Returns are tracked via PaymentStatus or elsewhere
    returned_purchases = base_query.filter(models.Purchase.PaymentStatus == 'Returned').all()

    total_gross_purchases = sum(float(p.GrandTotal or 0.0) for p in completed_purchases)
    total_returns = sum(float(p.GrandTotal or 0.0) for p in returned_purchases)
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
        transactions.append(PurchaseTransaction(
            InvoiceNo=p.InvoiceNumber or str(p.PurchaseId),
            PurchaseDate=p.PurchaseDate,
            SupplierName=supplier_name,
            MedicinesPurchased=len(p.items),
            TotalQty=total_qty,
            Discount=p.TotalDiscount,
            Tax=p.TotalTax,
            GrandTotal=float(p.GrandTotal or 0.0),
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
        period = p.PurchaseDate.strftime(fmt)
        if period in trend_dict:
            trend_dict[period] += float(p.GrandTotal or 0.0)

    trend_data = []
    for d in date_seq:
        trend_data.append(PurchaseTrendPoint(label=d, purchases=trend_dict[d]))

    # Suppliers Breakdown
    supp_dict = {}
    for p in completed_purchases:
        s_name = p.supplier.Name if p.supplier else 'Unknown'
        supp_dict[s_name] = supp_dict.get(s_name, 0) + float(p.GrandTotal or 0.0)
    suppliers = [SupplierStats(name=k, value=v) for k, v in supp_dict.items()]

    # Top Medicines
    med_dict = {}
    for p in completed_purchases:
        for i in p.items:
            med = db.query(models.Medicine).filter(models.Medicine.MedicineId == i.MedicineId).first()
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
