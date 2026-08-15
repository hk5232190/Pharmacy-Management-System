from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, text
from typing import List, Optional
from datetime import datetime, timedelta

from models import StockBatch, Medicine, Category, Company, Supplier, PurchaseItem, Purchase, PurchaseReturnItem, PurchaseReturn, StockAdjustment, AuditLog, SaleItem, Sale
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
        
        # Expiring Medicines (batches expiring within 90 days with stock > 0)
        ninety_days_from_now = datetime.utcnow().date() + timedelta(days=90)
        expiring_batches_count = db.query(StockBatch).filter(
            StockBatch.Quantity > 0,
            StockBatch.ExpiryDate <= ninety_days_from_now
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
        
        low_stock_items = sum(1 for m in medicine_stocks if 0 < m.total_qty <= m.ReorderLevel)
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
    try:
        # Base query joining necessary tables
        query = db.query(
            StockBatch, 
            Medicine, 
            Category, 
            Company
        ).join(Medicine, StockBatch.MedicineId == Medicine.MedicineId)\
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
        for batch, med, cat, comp in results:
            
            # Fetch Supplier Name from recent purchase item matching this batch
            # This is a bit heavy in a loop, but ok for small datasets.
            pi = db.query(PurchaseItem).join(Purchase, PurchaseItem.PurchaseId == Purchase.PurchaseId)\
                .filter(PurchaseItem.BatchCode == batch.BatchCode, PurchaseItem.MedicineId == batch.MedicineId)\
                .order_by(desc(Purchase.PurchaseDate)).first()
            
            supplier_name = "Unknown"
            if pi and pi.purchase and pi.purchase.supplier:
                supplier_name = pi.purchase.supplier.Name

            # Determine Status
            current_stock = batch.Quantity
            min_stock = med.ReorderLevel
            max_stock = (med.ReorderLevel * 3) if med.ReorderLevel > 0 else None
            
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
                "BatchId": batch.BatchId,
                "MedicineId": med.MedicineId,
                "CodeBarcode": med.Barcode or f"MED{med.MedicineId:05d}",
                "MedicineName": med.BrandName,
                "CategoryName": cat.CategoryName if cat else "Unknown",
                "CompanyName": comp.CompanyName if comp else "Unknown",
                "SupplierName": supplier_name,
                "BatchCode": batch.BatchCode,
                "RackNumber": med.RackNumber or "—",
                "ExpiryDate": batch.ExpiryDate,
                "PurchasePrice": float(batch.CostPrice),
                "SellingPrice": float(batch.SellingPrice),
                "CurrentStock": batch.Quantity,
                "MinStock": med.ReorderLevel,
                "Status": med_status,
                "StockValue": float(batch.Quantity * batch.CostPrice),
                "LastPurchaseDate": batch.ReceivedDate,
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
        batch = db.query(StockBatch).filter(StockBatch.BatchId == adjustment_in.BatchId).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Stock batch not found")

        if adjustment_in.AdjustmentType == "Decrease" and batch.Quantity < adjustment_in.Quantity:
            raise HTTPException(status_code=400, detail=f"Cannot decrease {adjustment_in.Quantity} units. Only {batch.Quantity} in stock.")

        # Perform Adjustment
        if adjustment_in.AdjustmentType == "Increase":
            batch.Quantity += adjustment_in.Quantity
        else:
            batch.Quantity -= adjustment_in.Quantity

        # Log in StockAdjustments
        new_adj = StockAdjustment(
            BatchId=batch.BatchId,
            UserId=current_user.UserId,
            AdjustmentType=adjustment_in.AdjustmentType,
            Quantity=adjustment_in.Quantity,
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
                "Reason": adj.Reason,
                "AdjustmentDate": adj.AdjustmentDate,
                "UserName": adj.user.FullName if adj.user else "Unknown"
            })
            
        return {"success": True, "data": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/expiry", summary="Get expiring and expired medicines")
def get_expiry_tracking(
    days: int = 90,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        # Fetch batches where ExpiryDate is within `days` or already expired, and stock > 0
        cutoff_date = datetime.utcnow().date() + timedelta(days=days)
        
        batches = db.query(StockBatch).join(Medicine).filter(
            StockBatch.Quantity > 0,
            StockBatch.ExpiryDate <= cutoff_date
        ).order_by(StockBatch.ExpiryDate).all()
        
        formatted_data = []
        today = datetime.utcnow().date()
        
        for batch in batches:
            days_to_expiry = (batch.ExpiryDate - today).days
            status = "Expired" if days_to_expiry < 0 else f"Expiring in {days_to_expiry} days"
            
            formatted_data.append({
                "BatchId": batch.BatchId,
                "MedicineName": batch.medicine.BrandName if batch.medicine else "Unknown",
                "CategoryName": batch.medicine.category.CategoryName if batch.medicine and batch.medicine.category else "Unknown",
                "SupplierName": "Unknown", # Could fetch from purchases if needed
                "BatchCode": batch.BatchCode,
                "CurrentStock": batch.Quantity,
                "ExpiryDate": batch.ExpiryDate,
                "DaysToExpiry": days_to_expiry,
                "ExpiryStatus": status
            })
            
        return {"success": True, "data": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/movements", response_model=BaseResponse[List[StockMovementResponse]], summary="Get unified stock movement history")
def get_stock_movements(
    batch_code: Optional[str] = None,
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
            if start_dt:
                q = q.filter(Purchase.PurchaseDate >= start_dt)
            if end_dt:
                q = q.filter(Purchase.PurchaseDate < end_dt)
                
            for pi, pur in q.all():
                movements.append({
                    "Date": pur.PurchaseDate,
                    "MedicineName": pi.medicine.BrandName if pi.medicine else "Unknown",
                    "BatchCode": pi.BatchCode,
                    "MovementType": "Purchase",
                    "QuantityChange": pi.Quantity,
                    "Reference": f"Invoice: {pur.InvoiceNumber}",
                    "UserName": pur.user.FullName if pur.user else "System"
                })

        # 2. Adjustments
        if not movement_type or movement_type == "Adjustment":
            q = db.query(StockAdjustment).join(StockBatch).join(Medicine, StockBatch.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(StockBatch.BatchCode.ilike(f"%{batch_code}%"))
            if start_dt:
                q = q.filter(StockAdjustment.AdjustmentDate >= start_dt)
            if end_dt:
                q = q.filter(StockAdjustment.AdjustmentDate < end_dt)
                
            for adj in q.all():
                movements.append({
                    "Date": adj.AdjustmentDate,
                    "MedicineName": adj.batch.medicine.BrandName if adj.batch and adj.batch.medicine else "Unknown",
                    "BatchCode": adj.batch.BatchCode if adj.batch else "Unknown",
                    "MovementType": "Adjustment",
                    "QuantityChange": adj.Quantity if adj.AdjustmentType == "Increase" else -adj.Quantity,
                    "Reference": f"Reason: {adj.Reason}",
                    "UserName": adj.user.FullName if adj.user else "System"
                })

        # 3. Sales
        if not movement_type or movement_type == "Sale":
            q = db.query(SaleItem, Sale).join(Sale, SaleItem.SalesId == Sale.SalesId).join(StockBatch, SaleItem.BatchId == StockBatch.BatchId).join(Medicine, StockBatch.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(StockBatch.BatchCode.ilike(f"%{batch_code}%"))
            if start_dt:
                q = q.filter(Sale.TransactionDate >= start_dt)
            if end_dt:
                q = q.filter(Sale.TransactionDate < end_dt)
                
            for si, sale in q.all():
                movements.append({
                    "Date": sale.TransactionDate,
                    "MedicineName": si.batch.medicine.BrandName if si.batch and si.batch.medicine else "Unknown",
                    "BatchCode": si.batch.BatchCode if si.batch else "Unknown",
                    "MovementType": "Sale",
                    "QuantityChange": -si.Quantity,
                    "Reference": f"Invoice: {sale.InvoiceNumber}",
                    "UserName": sale.user.FullName if sale.user else "System"
                })

        # 4. Purchase Returns
        if not movement_type or movement_type == "Return":
            q = db.query(PurchaseReturnItem, PurchaseReturn).join(PurchaseReturn, PurchaseReturnItem.ReturnId == PurchaseReturn.ReturnId).join(Medicine, PurchaseReturnItem.MedicineId == Medicine.MedicineId)
            if batch_code:
                q = q.filter(PurchaseReturnItem.BatchCode.ilike(f"%{batch_code}%"))
            if start_dt:
                q = q.filter(PurchaseReturn.ReturnDate >= start_dt)
            if end_dt:
                q = q.filter(PurchaseReturn.ReturnDate < end_dt)
                
            for pri, pr in q.all():
                movements.append({
                    "Date": pr.ReturnDate,
                    "MedicineName": pri.medicine.BrandName if pri.medicine else "Unknown",
                    "BatchCode": pri.BatchCode,
                    "MovementType": "Return",
                    "QuantityChange": -pri.ReturnQuantity,
                    "Reference": f"Return Inv: {pr.ReturnInvoiceNumber}",
                    "UserName": "System"
                })

        # Sort combined movements by Date descending
        movements.sort(key=lambda x: x["Date"], reverse=True)
        
        # Apply limit
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


