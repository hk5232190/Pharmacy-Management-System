from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime

from models import Sale, Medicine, StockBatch
from schemas.base import BaseResponse
from schemas.sales import SaleInitResponse, ProductSearchResponse, ProductSearchBatch
from api.deps import get_current_user, get_db
from core.config import settings

router = APIRouter()

@router.get("/init", response_model=BaseResponse[SaleInitResponse], summary="Initialize a new POS sale")
def init_sale(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        # Generate a temporary invoice number based on current count
        # E.g. INV-2608-0001
        current_year_month = datetime.now().strftime("%y%m")
        count = db.query(Sale).filter(Sale.InvoiceNumber.like(f"INV-{current_year_month}-%")).count()
        next_seq = count + 1
        invoice_no = f"INV-{current_year_month}-{next_seq:04d}"

        data = SaleInitResponse(
            InvoiceNumber=invoice_no,
            DefaultTaxRate=settings.DEFAULT_TAX_RATE
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search-product", response_model=BaseResponse[List[ProductSearchResponse]], summary="Search medicines for POS with FEFO batches")
def search_product(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        search_term = f"%{q}%"
        
        # Find medicines matching the query (Name, GenericName, or Barcode)
        medicines = db.query(Medicine).filter(
            Medicine.IsActive == True,
            or_(
                Medicine.BrandName.ilike(search_term),
                Medicine.GenericName.ilike(search_term),
                Medicine.Barcode.ilike(search_term)
            )
        ).all()

        results = []
        for med in medicines:
            # Get batches with available stock, sorted by ExpiryDate ascending (FEFO)
            batches = db.query(StockBatch).filter(
                StockBatch.MedicineId == med.MedicineId,
                StockBatch.Quantity > 0
            ).order_by(StockBatch.ExpiryDate.asc()).all()

            if not batches:
                continue # Skip medicines with no active stock

            batch_list = [
                ProductSearchBatch(
                    BatchId=b.BatchId,
                    BatchCode=b.BatchCode,
                    ExpiryDate=b.ExpiryDate,
                    AvailableStock=b.Quantity,
                    UnitPrice=float(b.SellingPrice)
                )
                for b in batches
            ]

            results.append(ProductSearchResponse(
                MedicineId=med.MedicineId,
                MedicineName=med.BrandName,
                GenericName=med.GenericName,
                RequiresPrescription=med.RequiresPrescription,
                Batches=batch_list
            ))

        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from schemas.sales import SaleCreate
from models import SaleItem, AuditLog
from core.exceptions import ValidationError
import datetime as dt

@router.post("/", response_model=BaseResponse[dict], summary="Complete a sale")
def complete_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        if not sale_data.Items:
            raise ValidationError("Cart is empty")

        # Prescription Validation
        for item in sale_data.Items:
            if item.RequiresPrescription and not sale_data.PrescriptionRef:
                raise ValidationError(f"Prescription reference is required for restricted medicines (e.g. {item.MedicineId})")

        current_date = dt.date.today()

        # Create Sale Record
        current_year_month = datetime.now().strftime("%y%m")
        count = db.query(Sale).filter(Sale.InvoiceNumber.like(f"INV-{current_year_month}-%")).count()
        invoice_no = f"INV-{current_year_month}-{(count + 1):04d}"

        new_sale = Sale(
            CustomerId=sale_data.CustomerId,
            UserId=current_user.UserId,
            InvoiceNumber=invoice_no,
            SubTotal=sale_data.SubTotal,
            DiscountAmount=sale_data.DiscountAmount,
            TaxAmount=sale_data.TaxAmount,
            GrandTotal=sale_data.GrandTotal,
            PaidAmount=sale_data.PaidAmount,
            PaymentMethod=sale_data.PaymentMethod,
            Status="Completed" if sale_data.PaidAmount >= sale_data.GrandTotal else "Pending",
            PrescriptionRef=sale_data.PrescriptionRef
        )
        db.add(new_sale)
        db.flush() # To get SalesId

        for item in sale_data.Items:
            remaining_qty_to_fulfill = item.Quantity
            
            # Strict FEFO Deduction & Expiration Check
            batches = db.query(StockBatch).filter(
                StockBatch.MedicineId == item.MedicineId,
                StockBatch.ExpiryDate > current_date, # Strictly block expired
                StockBatch.Quantity > 0
            ).order_by(StockBatch.ExpiryDate.asc()).with_for_update().all()

            if not batches:
                raise ValidationError(f"No valid, unexpired stock available for medicine ID {item.MedicineId}")

            total_available = sum(b.Quantity for b in batches)
            if total_available < remaining_qty_to_fulfill:
                raise ValidationError(f"Insufficient unexpired stock for medicine ID {item.MedicineId}. Requested {item.Quantity}, available {total_available}.")

            # Cascade FEFO
            for batch in batches:
                if remaining_qty_to_fulfill <= 0:
                    break
                
                qty_from_this_batch = min(batch.Quantity, remaining_qty_to_fulfill)
                
                # Deduct stock
                batch.Quantity -= qty_from_this_batch
                remaining_qty_to_fulfill -= qty_from_this_batch
                
                # Pro-rata financials for this specific batch split
                ratio = qty_from_this_batch / item.Quantity
                
                sale_item = SaleItem(
                    SalesId=new_sale.SalesId,
                    BatchId=batch.BatchId,
                    Quantity=qty_from_this_batch,
                    UnitPrice=item.UnitPrice,
                    Discount=item.Discount * ratio,
                    Tax=item.LineTotal * (item.TaxPercent / 100) * ratio,
                    TotalPrice=item.LineTotal * ratio
                )
                db.add(sale_item)

        # Audit Log
        audit = AuditLog(
            UserId=current_user.UserId,
            Action="Sale Created",
            Description=f"Generated invoice {invoice_no} for amount {sale_data.GrandTotal}"
        )
        db.add(audit)

        db.commit()
        return {"success": True, "data": {"InvoiceNumber": invoice_no, "SalesId": new_sale.SalesId}}
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

import os

@router.post("/{sales_id}/print-thermal", response_model=BaseResponse[dict], summary="Spool ESC/POS receipt for thermal printer")
def print_thermal_receipt(
    sales_id: int,
    is_reprint: bool = Query(False),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        sale = db.query(Sale).filter(Sale.SalesId == sales_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        
        # Build ESC/POS bytes
        ESC = b'\x1b'
        GS = b'\x1d'
        LF = b'\x0a'
        
        INIT = ESC + b'@'
        ALIGN_CENTER = ESC + b'a\x01'
        ALIGN_LEFT = ESC + b'a\x00'
        BOLD_ON = ESC + b'E\x01'
        BOLD_OFF = ESC + b'E\x00'
        CUT = GS + b'V\x00'
        
        bytes_data = bytearray()
        bytes_data += INIT
        
        # Header
        bytes_data += ALIGN_CENTER + BOLD_ON + b"PHARMACY MANAGEMENT SYSTEM\n" + BOLD_OFF
        bytes_data += b"123 Health Ave, Medical City\n"
        bytes_data += b"Tel: +1 234 567 8900\n\n"
        
        if is_reprint:
            bytes_data += BOLD_ON + b"*** DUPLICATE / REPRINT ***\n\n" + BOLD_OFF
        
        # Details
        bytes_data += ALIGN_LEFT
        bytes_data += f"Invoice : {sale.InvoiceNumber}\n".encode()
        bytes_data += f"Date    : {sale.TransactionDate.strftime('%Y-%m-%d %H:%M')}\n".encode()
        bytes_data += f"Cashier : {sale.user.Username if sale.user else 'Admin'}\n".encode()
        bytes_data += b"------------------------------------------\n"
        
        # Items
        for item in sale.items:
            med_name = item.batch.medicine.BrandName if item.batch and item.batch.medicine else "Unknown"
            batch_code = item.batch.BatchCode if item.batch else "N/A"
            expiry = item.batch.ExpiryDate.strftime('%y-%m') if item.batch and item.batch.ExpiryDate else "N/A"
            
            bytes_data += f"{med_name}\n".encode()
            bytes_data += f"  Batch: {batch_code} | Exp: {expiry}\n".encode()
            
            # Right align total
            qty_price = f"  {item.Quantity} x {item.UnitPrice:.2f}"
            total_str = f"{item.TotalPrice:.2f}"
            spaces = 42 - len(qty_price) - len(total_str)
            if spaces < 1: spaces = 1
            
            bytes_data += f"{qty_price}{' ' * spaces}{total_str}\n".encode()
            
        bytes_data += b"------------------------------------------\n"
        
        # Totals
        def add_total_line(label, amount):
            amt_str = f"{amount:.2f}"
            spaces = 42 - len(label) - len(amt_str)
            if spaces < 1: spaces = 1
            return f"{label}{' ' * spaces}{amt_str}\n".encode()
            
        bytes_data += add_total_line("Subtotal:", sale.SubTotal)
        bytes_data += add_total_line("Discount:", sale.DiscountAmount)
        bytes_data += BOLD_ON + add_total_line("GRAND TOTAL:", sale.GrandTotal) + BOLD_OFF
        bytes_data += b"\n"
        bytes_data += add_total_line("Paid:", sale.PaidAmount)
        change = max(0, float(sale.PaidAmount) - float(sale.GrandTotal))
        bytes_data += add_total_line("Change:", change)
        
        # Footer
        bytes_data += b"\n"
        bytes_data += ALIGN_CENTER
        bytes_data += b"Thank you for your visit!\n"
        bytes_data += b"Software License ID: LIC-9942-AX3\n"
        bytes_data += LF * 4 + CUT
        
        # Save to spooler
        spooler_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "spooler")
        os.makedirs(spooler_dir, exist_ok=True)
        
        filename = f"{sale.InvoiceNumber}.bin"
        filepath = os.path.join(spooler_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(bytes_data)
            
        return {"success": True, "data": {"message": f"Receipt spooled to {filename}"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from schemas.sales import SaleHistoryItem
from models import Customer

@router.get("/history", response_model=BaseResponse[List[SaleHistoryItem]], summary="Fetch sales history with advanced filtering")
def get_sales_history(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        query = db.query(Sale)
        
        if start_date:
            try:
                sd = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(Sale.TransactionDate >= sd)
            except Exception:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                query = query.filter(Sale.TransactionDate <= ed)
            except Exception:
                pass
                
        if payment_method:
            query = query.filter(Sale.PaymentMethod == payment_method)
            
        if user_id:
            query = query.filter(Sale.UserId == user_id)
            
        if q:
            search_term = f"%{q}%"
            query = query.outerjoin(Customer).filter(
                or_(
                    Sale.InvoiceNumber.ilike(search_term),
                    Customer.Name.ilike(search_term)
                )
            )
            
        sales = query.order_by(Sale.TransactionDate.desc()).limit(100).all()
        
        results = []
        for sale in sales:
            total_items = sum(i.Quantity for i in sale.items)
            returned_items = 0
            returns = db.query(SaleReturn).filter(SaleReturn.SalesId == sale.SalesId).all()
            for r in returns:
                returned_items += sum(ri.ReturnQuantity for ri in r.items)
                
            status = sale.Status
            if returned_items > 0:
                if returned_items >= total_items and total_items > 0:
                    status = "Fully Refunded"
                else:
                    status = "Partially Returned"
                    
            results.append(SaleHistoryItem(
                SalesId=sale.SalesId,
                InvoiceNumber=sale.InvoiceNumber,
                TransactionDate=sale.TransactionDate.strftime('%Y-%m-%d %H:%M'),
                CustomerName=sale.customer.Name if sale.customer else "Walk-in",
                CashierName=sale.user.Username if sale.user else "Unknown",
                PaymentMethod=sale.PaymentMethod,
                GrandTotal=float(sale.GrandTotal),
                Status=status
            ))
            
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from schemas.sales import InvoiceSearchResponse, InvoiceSearchItem, SaleReturnCreate
from models import SaleReturn, SaleReturnItem, StockAdjustment

@router.get("/invoice/{invoice_no}", response_model=BaseResponse[InvoiceSearchResponse], summary="Fetch invoice for return processing")
def get_invoice_for_return(
    invoice_no: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        sale = db.query(Sale).filter(Sale.InvoiceNumber == invoice_no).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Calculate already returned quantities per SalesItemId
        returned_qtys = {}
        for ret in sale.items: # Actually, we need to query SaleReturnItem via SaleReturn
            pass
            
        returns = db.query(SaleReturn).filter(SaleReturn.SalesId == sale.SalesId).all()
        for r in returns:
            for ri in r.items:
                # Wait, SaleReturnItem doesn't have SalesItemId in the model?
                # Ah! In models.py I forgot to add SalesItemId to SaleReturnItem.
                # Let's fix that. Wait, I didn't add it in models.py, I just added BatchId.
                # I should map it by BatchId then for this sale.
                pass
                
        # Actually, let's just calculate based on BatchId for this sale
        returned_by_batch = {}
        returns = db.query(SaleReturn).filter(SaleReturn.SalesId == sale.SalesId).all()
        for r in returns:
            for ri in r.items:
                returned_by_batch[ri.BatchId] = returned_by_batch.get(ri.BatchId, 0) + ri.ReturnQuantity

        items_resp = []
        for item in sale.items:
            med_name = item.batch.medicine.BrandName if item.batch and item.batch.medicine else "Unknown"
            batch_code = item.batch.BatchCode if item.batch else "N/A"
            already_returned = returned_by_batch.get(item.BatchId, 0)
            
            items_resp.append(InvoiceSearchItem(
                SalesItemId=item.SalesItemId,
                BatchId=item.BatchId,
                MedicineName=med_name,
                BatchCode=batch_code,
                Quantity=item.Quantity,
                ReturnedQuantity=already_returned,
                UnitPrice=float(item.UnitPrice),
                Discount=float(item.Discount),
                Tax=float(item.Tax),
                TotalPrice=float(item.TotalPrice)
            ))
            
        resp = InvoiceSearchResponse(
            SalesId=sale.SalesId,
            InvoiceNumber=sale.InvoiceNumber,
            TransactionDate=sale.TransactionDate.strftime('%Y-%m-%d %H:%M'),
            CustomerName=sale.customer.Name if sale.customer else "Walk-in",
            Items=items_resp,
            SubTotal=float(sale.SubTotal),
            DiscountAmount=float(sale.DiscountAmount),
            GrandTotal=float(sale.GrandTotal)
        )
        return {"success": True, "data": resp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/return", response_model=BaseResponse[dict], summary="Process a sales return")
def process_sales_return(
    return_data: SaleReturnCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        sale = db.query(Sale).filter(Sale.InvoiceNumber == return_data.InvoiceNumber).first()
        if not sale:
            raise ValidationError("Original sale not found")
            
        # Return Window Policy: strictly 30 days
        days_since_sale = (datetime.now() - sale.TransactionDate).days
        if days_since_sale > 30:
            raise ValidationError(f"Return window expired. Sale is {days_since_sale} days old (Max 30 days).")
            
        if not return_data.Reason:
            raise ValidationError("Return reason is strictly mandatory.")

        # Calculate already returned to prevent over-returning
        returned_by_batch = {}
        returns = db.query(SaleReturn).filter(SaleReturn.SalesId == sale.SalesId).all()
        for r in returns:
            for ri in r.items:
                returned_by_batch[ri.BatchId] = returned_by_batch.get(ri.BatchId, 0) + ri.ReturnQuantity
                
        # Map original items by BatchId
        original_items = {item.BatchId: item for item in sale.items}

        total_refund = 0.0
        
        # Create Return Record
        current_year_month = datetime.now().strftime("%y%m")
        count = db.query(SaleReturn).filter(SaleReturn.ReturnInvoiceNumber.like(f"RET-{current_year_month}-%")).count()
        ret_invoice_no = f"RET-{current_year_month}-{(count + 1):04d}"
        
        new_return = SaleReturn(
            SalesId=sale.SalesId,
            UserId=current_user.UserId,
            ReturnInvoiceNumber=ret_invoice_no,
            TotalRefundAmount=0, # Will update
            Reason=return_data.Reason
        )
        db.add(new_return)
        db.flush()

        for ret_item in return_data.Items:
            if ret_item.ReturnQuantity <= 0:
                continue
                
            orig_item = original_items.get(ret_item.BatchId)
            if not orig_item:
                raise ValidationError(f"Batch {ret_item.BatchId} was not part of this sale.")
                
            already_ret = returned_by_batch.get(ret_item.BatchId, 0)
            if already_ret + ret_item.ReturnQuantity > orig_item.Quantity:
                raise ValidationError(f"Cannot return more than originally sold for Batch {ret_item.BatchId}.")
                
            # Discount recalculation: refund is proportional to the original total price after discount
            ratio = ret_item.ReturnQuantity / orig_item.Quantity
            item_refund = float(orig_item.TotalPrice) * ratio
            total_refund += item_refund
            
            # Stock Update vs Quarantine
            batch = db.query(StockBatch).filter(StockBatch.BatchId == ret_item.BatchId).with_for_update().first()
            if not batch:
                raise ValidationError(f"Batch {ret_item.BatchId} no longer exists in inventory.")
                
            if ret_item.ItemCondition == "Restockable":
                batch.Quantity += ret_item.ReturnQuantity
            elif ret_item.ItemCondition == "Damaged/Quarantine":
                # Do NOT increment StockBatch. Log as write-off.
                adjustment = StockAdjustment(
                    BatchId=batch.BatchId,
                    UserId=current_user.UserId,
                    AdjustmentType="Decrease", # It's a write-off, but it never entered stock so technically we just log it.
                    # Actually, if it never enters stock, we might just log it as a loss.
                    # Wait, StockAdjustment requires Quantity > 0 and type Decrease.
                    Quantity=ret_item.ReturnQuantity,
                    Reason=f"Quarantine from Return {ret_invoice_no}: {return_data.Reason}"
                )
                db.add(adjustment)
            else:
                raise ValidationError(f"Invalid ItemCondition: {ret_item.ItemCondition}")
                
            ri = SaleReturnItem(
                ReturnId=new_return.ReturnId,
                BatchId=ret_item.BatchId,
                ReturnQuantity=ret_item.ReturnQuantity,
                RefundAmount=item_refund,
                ItemCondition=ret_item.ItemCondition
            )
            db.add(ri)
            
        new_return.TotalRefundAmount = total_refund
        
        # Audit Logging
        audit = AuditLog(
            UserId=current_user.UserId,
            Action="Sale Return Processed",
            Description=f"Processed return {ret_invoice_no} for Sale {sale.InvoiceNumber}. Refund: {total_refund:.2f}. Reason: {return_data.Reason}"
        )
        db.add(audit)
        
        db.commit()
        return {"success": True, "data": {"ReturnInvoiceNumber": ret_invoice_no, "RefundAmount": total_refund}}
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
