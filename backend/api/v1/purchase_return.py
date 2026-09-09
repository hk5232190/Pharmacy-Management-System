from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List
from decimal import Decimal

from models import PurchaseReturn, PurchaseReturnItem, StockBatch, Supplier, Medicine, Purchase, PurchaseItem, InventorySettings
from schemas.purchase_return import PurchaseReturnCreate, PurchaseReturnResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.post("", response_model=BaseResponse[PurchaseReturnResponse], summary="Create a new purchase return")
def create_purchase_return(
    return_in: PurchaseReturnCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.SupplierId == return_in.SupplierId).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    try:
        new_return = PurchaseReturn(
            PurchaseId=return_in.PurchaseId,
            SupplierId=return_in.SupplierId,
            ReturnInvoiceNumber=return_in.ReturnInvoiceNumber,
            TotalRefundAmount=return_in.TotalRefundAmount,
            Reason=return_in.Reason,
            SettlementType=return_in.SettlementType
        )
        db.add(new_return)
        db.flush()
        
        inv_settings = db.query(InventorySettings).first()
        allow_negative = inv_settings.AllowNegativeStock if inv_settings else False
        
        # Update Purchase Record
        purchase = db.query(Purchase).filter(Purchase.PurchaseId == return_in.PurchaseId).first()
        if not purchase:
            db.rollback()
            raise HTTPException(status_code=404, detail="Purchase record not found")
            
        purchase.ReturnedAmount += Decimal(str(return_in.TotalRefundAmount))
        purchase.NetAmount -= Decimal(str(return_in.TotalRefundAmount))
        if purchase.NetAmount <= 0 and purchase.GrandTotal > 0:
            purchase.PaymentStatus = 'Returned'
        
        
        for item in return_in.items:
            medicine = db.query(Medicine).filter(Medicine.MedicineId == item.MedicineId).first()
            if not medicine:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Medicine ID {item.MedicineId} not found")
                
            new_item = PurchaseReturnItem(
                ReturnId=new_return.ReturnId,
                MedicineId=item.MedicineId,
                BatchCode=item.BatchCode,
                ReturnQuantity=item.ReturnQuantity,
                RefundAmount=item.RefundAmount,
                ReturnReason=item.ReturnReason
            )
            db.add(new_item)
            
            # Update original PurchaseItem
            purchase_item = db.query(PurchaseItem).filter(
                PurchaseItem.PurchaseId == purchase.PurchaseId,
                PurchaseItem.MedicineId == item.MedicineId,
                PurchaseItem.BatchCode == item.BatchCode
            ).first()
            if purchase_item:
                purchase_item.ReturnedQuantity += item.ReturnQuantity
            
            
            # Deduct from StockBatch
            existing_batch = db.query(StockBatch).filter(
                StockBatch.MedicineId == item.MedicineId,
                StockBatch.BatchCode == item.BatchCode
            ).with_for_update().first()
            
            if not existing_batch:
                if not allow_negative:
                    db.rollback()
                    raise HTTPException(status_code=400, detail=f"Batch {item.BatchCode} for medicine {medicine.BrandName} not found in stock.")
                else:
                    # Create dummy negative batch if allowed
                    existing_batch = StockBatch(
                        MedicineId=item.MedicineId,
                        BatchCode=item.BatchCode,
                        Quantity=0,
                        CostPrice=0,
                        SellingPrice=0,
                        ExpiryDate=None
                    )
                    db.add(existing_batch)
                    db.flush()
                
            if existing_batch.Quantity < item.ReturnQuantity and not allow_negative:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Cannot return {item.ReturnQuantity} of {medicine.BrandName} (Batch {item.BatchCode}). Only {existing_batch.Quantity} in stock.")
                
            existing_batch.Quantity -= item.ReturnQuantity
                
        if return_in.SettlementType == "Adjust in Supplier Balance":
            supplier.CurrentBalance -= Decimal(str(return_in.TotalRefundAmount))
            
        db.commit()
        db.refresh(new_return)
        
        return {"data": None, "message": "Purchase return processed and stock deducted successfully!"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

@router.get("", response_model=BaseResponse[List[PurchaseReturnResponse]], summary="Get all purchase returns")
def get_purchase_returns(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    returns = (
        db.query(PurchaseReturn)
        .options(
            joinedload(PurchaseReturn.supplier),
            joinedload(PurchaseReturn.purchase),
            joinedload(PurchaseReturn.items).joinedload(PurchaseReturnItem.medicine),
        )
        .order_by(desc(PurchaseReturn.ReturnDate))
        .limit(limit)
        .all()
    )
    
    result = []
    for r in returns:
        r_dict = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        r_dict["SupplierName"] = r.supplier.Name if r.supplier else None
        r_dict["OriginalInvoiceNumber"] = r.purchase.InvoiceNumber if r.purchase else None
        
        items_list = []
        for i in r.items:
            i_dict = {c.name: getattr(i, c.name) for c in i.__table__.columns}
            i_dict["MedicineName"] = i.medicine.BrandName if i.medicine else None
            items_list.append(i_dict)
            
        r_dict["items"] = items_list
        result.append(r_dict)
        
    return {"data": result}
