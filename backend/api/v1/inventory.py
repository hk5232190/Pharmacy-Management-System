from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, text
from typing import List, Optional
from datetime import datetime, timedelta, date

from models import StockBatch, Medicine, Category, Company, Supplier, PurchaseItem, Purchase, PurchaseReturnItem, PurchaseReturn, StockAdjustment, AuditLog, SaleItem, Sale, InventorySettings
from schemas.base import BaseResponse
from schemas.inventory import StockAdjustmentCreate, StockAdjustmentResponse, StockMovementResponse, AuditLogResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.get("/summary", summary="Get inventory summary KPIs")
def get_inventory_summary(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        # Total Active Medicines
        total_medicines = db.query(Medicine).filter(Medicine.IsActive == True).count()
        
        # Total Stock Quantity & Inventory Value
        stock_agg = db.query(
            func.sum(StockBatch.Quantity).label("total_qty"),
            func.sum(StockBatch.Quantity * StockBatch.CostPrice).label("total_value")
        ).first()
        
        total_stock_quantity = int(stock_agg.total_qty or 0)
        inventory_value = float(stock_agg.total_value or 0)
        
        inv_settings = db.query(InventorySettings).first()
        expiry_alert_days = inv_settings.ExpiryAlertDays if inv_settings else 90
        low_stock_threshold = inv_settings.LowStockThreshold if inv_settings else 10

        today = date.today()
        alert_days_from_now = today + timedelta(days=expiry_alert_days)
        
        # Expiring Medicines (batches expiring within alert days with stock > 0)
        expiring_batches_count = db.query(StockBatch).filter(
            StockBatch.Quantity > 0,
            StockBatch.ExpiryDate <= alert_days_from_now
        ).count()
        
        # Low Stock & Out of Stock
        # We need to aggregate quantity per medicine and compare with ReorderLevel
        medicine_stocks = db.query(
            Medicine.MedicineId,
            Medicine.ReorderLevel,
            func.coalesce(func.sum(StockBatch.Quantity), 0).label("total_qty")
        ).outerjoin(StockBatch, Medicine.MedicineId == StockBatch.MedicineId)\
         .filter(Medicine.IsActive == True)\
         .group_by(Medicine.MedicineId, Medicine.ReorderLevel).all()
        
        low_stock_items = sum(1 for m in medicine_stocks if 0 < m.total_qty <= (m.ReorderLevel if m.ReorderLevel and m.ReorderLevel > 0 else low_stock_threshold))
        out_of_stock_medicines = sum(1 for m in medicine_stocks if m.total_qty == 0)
        
        # Overstock Items (arbitrary rule: Stock > 3 * ReorderLevel)
        overstock_query = text('''
            SELECT COUNT(*) FROM (
                SELECT m.MedicineId, SUM(b.Quantity) as total_qty, m.ReorderLevel
                FROM medicines m
                JOIN stock_batches b ON m.MedicineId = b.MedicineId
                GROUP BY m.MedicineId
            ) AS sub WHERE total_qty > (ReorderLevel * 3) AND ReorderLevel > 0
        ''')
        overstock_items = db.execute(overstock_query).scalar() or 0
        
        return {
            "success": True,
            "data": {
                "total_medicines": total_medicines,
                "total_stock_quantity": total_stock_quantity,
                "inventory_value": inventory_value,
                "low_stock_items": low_stock_items,
                "expiring_medicines": expiring_batches_count,
                "out_of_stock_medicines": out_of_stock_medicines,
                "overstock_items": overstock_items
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stock", summary="Get detailed stock batches")
def get_stock_list(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    inv_settings = db.query(InventorySettings).first()
    low_stock_threshold = inv_settings.LowStockThreshold if inv_settings else 10

    try:
        # Base query joining necessary tables, starting from Medicine to include out of stock ones
        query = db.query(
            Medicine,
            StockBatch, 
            Category, 
            Company
        ).outerjoin(StockBatch, Medicine.MedicineId == StockBatch.MedicineId)\
         .outerjoin(Category, Medicine.CategoryId == Category.CategoryId)\
         .outerjoin(Company, Medicine.CompanyId == Company.CompanyId)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Medicine.BrandName.ilike(search_term),
                    Medicine.Barcode.ilike(search_term),
                    StockBatch.BatchCode.ilike(search_term)
                )
            )
            
        if category_id:
            query = query.filter(Medicine.CategoryId == category_id)
            
        if company_id:
            query = query.filter(Medicine.CompanyId == company_id)
            
        results = query.order_by(desc(StockBatch.ReceivedDate)).limit(limit).all()
        
        formatted_data = []
        for med, batch, cat, comp in results:
            
            supplier_name = "Unknown"
            if batch:
                pi = db.query(PurchaseItem).join(Purchase, PurchaseItem.PurchaseId == Purchase.PurchaseId)\
                    .filter(PurchaseItem.BatchCode == batch.BatchCode, PurchaseItem.MedicineId == batch.MedicineId)\
                    .order_by(desc(Purchase.PurchaseDate)).first()
                if pi and pi.purchase and pi.purchase.supplier:
                    supplier_name = pi.purchase.supplier.Name

            # Determine Status
            current_stock = batch.Quantity if batch else 0
            min_stock = med.ReorderLevel if med.ReorderLevel and med.ReorderLevel > 0 else low_stock_threshold
            max_stock = (min_stock * 3) if min_stock > 0 else None
            
            if current_stock <= 0:
                med_status = "Out of Stock"
            elif current_stock > 0 and current_stock <= min_stock:
                med_status = "Low Stock"
            elif max_stock is not None and current_stock > max_stock:
                med_status = "Overstock"
            else:
                med_status = "In Stock"
                
            if status and status != "All" and med_status != status:
                continue 
                
            formatted_data.append({
                "BatchId": batch.BatchId if batch else -med.MedicineId,
                "MedicineId": med.MedicineId,
                "CodeBarcode": med.Barcode or f"MED{med.MedicineId:05d}",
                "MedicineName": med.BrandName,
                "CategoryName": cat.CategoryName if cat else "Unknown",
                "CompanyName": comp.CompanyName if comp else "Unknown",
                "SupplierName": supplier_name,
                "BatchCode": batch.BatchCode if batch else "—",
                "RackNumber": med.RackNumber or "—",
                "ExpiryDate": batch.ExpiryDate if batch else None,
                "PurchasePrice": float(batch.CostPrice) if batch else 0.0,
                "SellingPrice": float(batch.SellingPrice) if batch else 0.0,
                "CurrentStock": current_stock,
                "MinStock": med.ReorderLevel,
                "Status": med_status,
                "StockValue": float(current_stock * batch.CostPrice) if batch else 0.0,
                "LastPurchaseDate": batch.ReceivedDate if batch else None,
                "LastSaleDate": None
            })
            
        return {
            "success": True,
            "data": formatted_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/adjust", summary="Adjust stock for a batch")
def adjust_stock(
    adjustment_in: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        batch = db.query(StockBatch).filter(StockBatch.BatchId == adjustment_in.BatchId).with_for_update().first()
        if not batch:
            raise HTTPException(status_code=404, detail="Stock batch not found")

        inv_settings = db.query(InventorySettings).first()
        allow_negative = inv_settings.AllowNegativeStock if inv_settings else False

        if adjustment_in.AdjustmentType == "Decrease" and batch.Quantity < adjustment_in.Quantity and not allow_negative:
            raise HTTPException(status_code=400, detail=f"Cannot decrease {adjustment_in.Quantity} units. Only {batch.Quantity} in stock.")

        previous_qty = batch.Quantity

        # Perform Adjustment
        if adjustment_in.AdjustmentType == "Increase":
            batch.Quantity += adjustment_in.Quantity
        else:
            batch.Quantity -= adjustment_in.Quantity
            
        new_qty = batch.Quantity

        # Log in StockAdjustments
        new_adj = StockAdjustment(
            BatchId=batch.BatchId,
            UserId=current_user.UserId,
            AdjustmentType=adjustment_in.AdjustmentType,
            Quantity=adjustment_in.Quantity,
            PreviousQuantity=previous_qty,
            NewQuantity=new_qty,
            Reason=adjustment_in.Reason
        )
        db.add(new_adj)

        # Log in AuditLogs
        medicine = batch.medicine
        audit_log = AuditLog(
            UserId=current_user.UserId,
            Action="STOCK_ADJUSTMENT",
            Description=f"{adjustment_in.AdjustmentType}d stock by {adjustment_in.Quantity} for {medicine.BrandName} (Batch: {batch.BatchCode}). Reason: {adjustment_in.Reason}"
        )
        db.add(audit_log)

        db.commit()

        return {"success": True, "message": f"Stock successfully {adjustment_in.AdjustmentType.lower()}d."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/adjustments", response_model=BaseResponse[List[StockAdjustmentResponse]], summary="Get stock adjustments history")
def get_adjustments(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        adjustments = db.query(StockAdjustment).order_by(desc(StockAdjustment.AdjustmentDate)).limit(limit).all()
        
        formatted_data = []
        for adj in adjustments:
            formatted_data.append({
                "AdjustmentId": adj.AdjustmentId,
                "BatchId": adj.BatchId,
                "MedicineName": adj.batch.medicine.BrandName if adj.batch and adj.batch.medicine else "Unknown",
                "BatchCode": adj.batch.BatchCode if adj.batch else "Unknown",
                "AdjustmentType": adj.AdjustmentType,
                "Quantity": adj.Quantity,
                "PreviousQuantity": adj.PreviousQuantity,
                "NewQuantity": adj.NewQuantity,
                "Reason": adj.Reason,
                "AdjustmentDate": adj.AdjustmentDate,
                "UserName": adj.user.FullName if adj.user else "Unknown"
            })
            
        return {"success": True, "data": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/expiry", summary="Get expiring and expired medicines")
def get_expiry_tracking(
    days: int = 30,
    medicine_name: Optional[str] = None,
    batch_code: Optional[str] = None,
    supplier_name: Optional[str] = None,
    page: int = 1,
    page_size: int = 15,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        today = datetime.utcnow().date()
        
        # 1. Global KPI Aggregation
        kpi_counts = {0: 0, 30: 0, 90: 0}
        kpi_values = {0: 0.0, 30: 0.0, 90: 0.0}
        
        for tier in [0, 30, 90]:
            if tier == 0:
                cond = StockBatch.ExpiryDate < today
            else:
                cond = StockBatch.ExpiryDate.between(today, today + timedelta(days=tier))
                
            batches = db.query(StockBatch).filter(
                StockBatch.Quantity > 0,
                cond
            ).all()
            
            kpi_counts[tier] = len(batches)
            kpi_values[tier] = sum(float(b.Quantity) * float(b.CostPrice) for b in batches)
            
        kpi_summary = {
            "expired_count": kpi_counts[0],
            "expired_value": kpi_values[0],
            "expiring_30d_count": kpi_counts[30],
            "expiring_30d_value": kpi_values[30],
            "expiring_90d_count": kpi_counts[90],
            "expiring_90d_value": kpi_values[90]
        }
        
        # 2. Main Query for List
        query = db.query(StockBatch).join(Medicine).filter(StockBatch.Quantity > 0)
        
        if days == -1:
            query = query.filter(StockBatch.ExpiryDate < today)
        elif days != 9999:
            cutoff_date = today + timedelta(days=days)
            query = query.filter(StockBatch.ExpiryDate <= cutoff_date)
            
        if medicine_name:
            query = query.filter(Medicine.BrandName.ilike(f"%{medicine_name}%"))
        if batch_code:
            query = query.filter(StockBatch.BatchCode.ilike(f"%{batch_code}%"))
            
        query = query.order_by(StockBatch.ExpiryDate)
        all_batches = query.all()
        
        # 3. Post-query processing and Supplier lookup
        formatted_data = []
        for batch in all_batches:
            latest_pi = (
                db.query(PurchaseItem)
                .join(Purchase, PurchaseItem.PurchaseId == Purchase.PurchaseId)
                .join(Supplier, Purchase.SupplierId == Supplier.SupplierId)
                .filter(
                    PurchaseItem.BatchCode == batch.BatchCode,
                    PurchaseItem.MedicineId == batch.MedicineId
                )
                .order_by(desc(Purchase.PurchaseDate))
                .first()
            )
            
            supplier_val = (
                latest_pi.purchase.supplier.Name
                if latest_pi and latest_pi.purchase and latest_pi.purchase.supplier
                else "N/A"
            )
            
            if supplier_name and supplier_name.lower() not in supplier_val.lower():
                continue
                
            days_to_expiry = (batch.ExpiryDate - today).days
            status = "Expired" if days_to_expiry < 0 else f"Expiring in {days_to_expiry} days"
            
            formatted_data.append({
                "BatchId": batch.BatchId,
                "MedicineName": batch.medicine.BrandName if batch.medicine else "Unknown",
                "CategoryName": batch.medicine.category.CategoryName if batch.medicine and batch.medicine.category else "Unknown",
                "SupplierName": supplier_val,
                "BatchCode": batch.BatchCode,
                "CurrentStock": batch.Quantity,
                "PurchasePrice": float(batch.CostPrice),
                "ValueAtRisk": float(batch.Quantity * batch.CostPrice),
                "ExpiryDate": batch.ExpiryDate,
                "DaysToExpiry": days_to_expiry,
                "ExpiryStatus": status
            })
            
        # 4. Pagination
        total = len(formatted_data)
        if page_size > 0:
            formatted_data = formatted_data[(page - 1) * page_size : page * page_size]
            
        return {
            "success": True, 
            "data": {
                "items": formatted_data,
                "total": total,
                "page": page,
                "page_size": page_size,
                "kpi_summary": kpi_summary
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/movements", response_model=BaseResponse[List[StockMovementResponse]], summary="Get unified stock movement history")
def get_stock_movements(
    batch_code: Optional[str] = None,
    medicine_name: Optional[str] = None,
    reference: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        movements = []

        # Helper to parse dates
        start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) if end_date else None

        # 1. Purchases
        if not movement_type or movement_type == "Purchase":
            q = db.query(PurchaseItem, Purchase).join(Purchase, PurchaseItem.PurchaseId == Purchase.PurchaseId).join(StockBatch, PurchaseItem.BatchCode == StockBatch.BatchCode, isouter=True).join(Medicine, PurchaseItem.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(PurchaseItem.BatchCode.ilike(f"%{batch_code}%"))
            if medicine_name:
                q = q.filter(Medicine.BrandName.ilike(f"%{medicine_name}%"))
            if start_dt:
                q = q.filter(Purchase.PurchaseDate >= start_dt)
            if end_dt:
                q = q.filter(Purchase.PurchaseDate < end_dt)
                
            for pi, pur in q.all():
                ref_val = f"Invoice: {pur.InvoiceNumber}"
                if reference and reference.lower() not in ref_val.lower():
                    continue
                movements.append({
                    "Date": pur.PurchaseDate,
                    "MedicineName": pi.medicine.BrandName if pi.medicine else "Unknown",
                    "BatchCode": pi.BatchCode,
                    "Barcode": pi.medicine.Barcode if pi.medicine else None,
                    "MovementType": "Purchase",
                    "QuantityChange": pi.Quantity,
                    "Reference": ref_val,
                    "SourceId": pur.PurchaseId,
                })

        # 2. Adjustments
        if not movement_type or movement_type == "Stock Adjustment":
            q = db.query(StockAdjustment).join(StockBatch).join(Medicine, StockBatch.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(StockBatch.BatchCode.ilike(f"%{batch_code}%"))
            if medicine_name:
                q = q.filter(Medicine.BrandName.ilike(f"%{medicine_name}%"))
            if start_dt:
                q = q.filter(StockAdjustment.AdjustmentDate >= start_dt)
            if end_dt:
                q = q.filter(StockAdjustment.AdjustmentDate < end_dt)
                
            for adj in q.all():
                ref_val = f"Reason: {adj.Reason}"
                if reference and reference.lower() not in ref_val.lower():
                    continue
                movements.append({
                    "Date": adj.AdjustmentDate,
                    "MedicineName": adj.batch.medicine.BrandName if adj.batch and adj.batch.medicine else "Unknown",
                    "BatchCode": adj.batch.BatchCode if adj.batch else "Unknown",
                    "Barcode": adj.batch.medicine.Barcode if adj.batch and adj.batch.medicine else None,
                    "MovementType": "Stock Adjustment",
                    "QuantityChange": adj.Quantity if adj.AdjustmentType == "Increase" else -adj.Quantity,
                    "Reference": ref_val,
                    "SourceId": adj.AdjustmentId,
                })

        # 3. Sales
        if not movement_type or movement_type == "POS Sale":
            q = db.query(SaleItem, Sale).join(Sale, SaleItem.SalesId == Sale.SalesId).join(StockBatch, SaleItem.BatchId == StockBatch.BatchId).join(Medicine, StockBatch.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(StockBatch.BatchCode.ilike(f"%{batch_code}%"))
            if medicine_name:
                q = q.filter(Medicine.BrandName.ilike(f"%{medicine_name}%"))
            if start_dt:
                q = q.filter(Sale.TransactionDate >= start_dt)
            if end_dt:
                q = q.filter(Sale.TransactionDate < end_dt)
                
            for si, sale in q.all():
                ref_val = f"Invoice: {sale.InvoiceNumber}"
                if reference and reference.lower() not in ref_val.lower():
                    continue
                movements.append({
                    "Date": sale.TransactionDate,
                    "MedicineName": si.batch.medicine.BrandName if si.batch and si.batch.medicine else "Unknown",
                    "BatchCode": si.batch.BatchCode if si.batch else "Unknown",
                    "Barcode": si.batch.medicine.Barcode if si.batch and si.batch.medicine else None,
                    "MovementType": "POS Sale",
                    "QuantityChange": -si.Quantity,
                    "Reference": ref_val,
                    "SourceId": sale.SalesId,
                })

        # 4. Purchase Returns
        if not movement_type or movement_type == "Purchase Return":
            q = db.query(PurchaseReturnItem, PurchaseReturn).join(PurchaseReturn, PurchaseReturnItem.ReturnId == PurchaseReturn.ReturnId).join(Medicine, PurchaseReturnItem.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(PurchaseReturnItem.BatchCode.ilike(f"%{batch_code}%"))
            if medicine_name:
                q = q.filter(Medicine.BrandName.ilike(f"%{medicine_name}%"))
            if start_dt:
                q = q.filter(PurchaseReturn.ReturnDate >= start_dt)
            if end_dt:
                q = q.filter(PurchaseReturn.ReturnDate < end_dt)
                
            for pri, pr in q.all():
                ref_val = f"Return Inv: {pr.ReturnInvoiceNumber}"
                if reference and reference.lower() not in ref_val.lower():
                    continue
                movements.append({
                    "Date": pr.ReturnDate,
                    "MedicineName": pri.medicine.BrandName if pri.medicine else "Unknown",
                    "BatchCode": pri.BatchCode,
                    "Barcode": pri.medicine.Barcode if pri.medicine else None,
                    "MovementType": "Purchase Return",
                    "QuantityChange": -pri.ReturnQuantity,
                    "Reference": ref_val,
                    "SourceId": pr.ReturnId,
                })

        # Sort all movements chronologically (oldest first) so we can compute running balance
        movements.sort(key=lambda x: x["Date"])

        # Compute running balance per batch
        batch_running_balance: dict = {}
        for mov in movements:
            bc = mov["BatchCode"]
            batch_running_balance[bc] = batch_running_balance.get(bc, 0) + mov["QuantityChange"]
            mov["BalanceStock"] = batch_running_balance[bc]

        # Reverse to show newest first for display, then apply limit
        movements.sort(key=lambda x: x["Date"], reverse=True)
        movements = movements[:limit]

        return {"success": True, "data": movements}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit-logs", response_model=BaseResponse[List[AuditLogResponse]], summary="Get system audit logs")
def get_audit_logs(
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        logs = db.query(AuditLog).order_by(desc(AuditLog.Timestamp)).limit(limit).all()
        formatted_data = []
        for log in logs:
            formatted_data.append({
                "LogId": log.LogId,
                "Timestamp": log.Timestamp,
                "Action": log.Action,
                "Description": log.Description,
                "UserName": log.user.FullName if log.user else "Unknown"
            })
        return {"success": True, "data": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


