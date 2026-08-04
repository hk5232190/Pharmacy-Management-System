from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime

from models import Purchase, PurchaseItem, StockBatch, Supplier, Medicine
from schemas.purchase import PurchaseCreate, PurchaseResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.post("", response_model=BaseResponse[PurchaseResponse], summary="Create a new purchase invoice")
def create_purchase(
    purchase_in: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Validate Supplier
    supplier = db.query(Supplier).filter(Supplier.SupplierId == purchase_in.SupplierId).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    try:
        # 2. Create Purchase record
        new_purchase = Purchase(
            SupplierId=purchase_in.SupplierId,
            InvoiceNumber=purchase_in.InvoiceNumber,
            SupplierInvNo=purchase_in.SupplierInvNo,
            PaymentStatus=purchase_in.PaymentStatus,
            PaymentMethod=purchase_in.PaymentMethod,
            Notes=purchase_in.Notes,
            SubTotal=purchase_in.SubTotal,
            TotalDiscount=purchase_in.TotalDiscount,
            TotalTax=purchase_in.TotalTax,
            GrandTotal=purchase_in.GrandTotal,
            PaidAmount=purchase_in.PaidAmount,
            RemainingBalance=purchase_in.RemainingBalance,
            PurchaseDate=purchase_in.PurchaseDate
        )
        db.add(new_purchase)
        db.flush() # To get PurchaseId
        
        # 3. Process Items and update Inventory (StockBatches)
        for item in purchase_in.items:
            # Verify medicine exists
            medicine = db.query(Medicine).filter(Medicine.MedicineId == item.MedicineId).first()
            if not medicine:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Medicine ID {item.MedicineId} not found")
                
            # Create PurchaseItem
            new_item = PurchaseItem(
                PurchaseId=new_purchase.PurchaseId,
                MedicineId=item.MedicineId,
                BatchCode=item.BatchCode,
                Quantity=item.Quantity,
                FreeQty=item.FreeQty,
                CostPrice=item.CostPrice,
                SellingPrice=item.SellingPrice,
                Discount=item.Discount,
                TaxPercentage=item.TaxPercentage,
                LineTotal=item.LineTotal,
                ManufacturingDate=item.ManufacturingDate,
                ExpiryDate=item.ExpiryDate
            )
            db.add(new_item)
            
            # Update/Create StockBatch
            # Check if this exact batch already exists for this medicine
            existing_batch = db.query(StockBatch).filter(
                StockBatch.MedicineId == item.MedicineId,
                StockBatch.BatchCode == item.BatchCode
            ).first()
            
            total_qty_received = item.Quantity + item.FreeQty
            
            if existing_batch:
                # Add to existing batch
                existing_batch.Quantity += total_qty_received
                # Update prices to the latest purchase prices
                existing_batch.CostPrice = item.CostPrice
                existing_batch.SellingPrice = item.SellingPrice
                # (Assuming ExpiryDate is the same for the same BatchCode)
            else:
                # Create new stock batch
                new_batch = StockBatch(
                    MedicineId=item.MedicineId,
                    BatchCode=item.BatchCode,
                    Quantity=total_qty_received,
                    CostPrice=item.CostPrice,
                    SellingPrice=item.SellingPrice,
                    ManufacturingDate=item.ManufacturingDate,
                    ExpiryDate=item.ExpiryDate
                )
                db.add(new_batch)
                
        # Commit the transaction
        db.commit()
        db.refresh(new_purchase)
        
        # Build response manually or query it back
        # For simplicity, returning a success message, but standard requests expect data.
        return {"data": None, "message": "Purchase created and inventory updated successfully!"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

@router.get("", response_model=BaseResponse[List[PurchaseResponse]], summary="Get all purchases")
def get_purchases(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    purchases = db.query(Purchase).order_by(desc(Purchase.PurchaseDate)).limit(limit).all()
    
    # We must format the response to include SupplierName and items
    result = []
    for p in purchases:
        p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        p_dict["SupplierName"] = p.supplier.Name if p.supplier else None
        
        items_list = []
        for i in p.items:
            i_dict = {c.name: getattr(i, c.name) for c in i.__table__.columns}
            i_dict["MedicineName"] = i.medicine.BrandName if i.medicine else None
            items_list.append(i_dict)
            
        p_dict["items"] = items_list
        result.append(p_dict)
        
    return {"data": result}
