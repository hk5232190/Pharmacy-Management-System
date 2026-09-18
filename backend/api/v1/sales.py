from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, timezone
import os
import sys
import logging

logger = logging.getLogger(__name__)

def utc_to_local_str(dt_obj):
    if not dt_obj:
        return ""
    return dt_obj.replace(tzinfo=timezone.utc).astimezone().strftime('%d/%m/%Y, %I:%M %p')

from models import Sale, Medicine, StockBatch, Customer, StockAdjustment, SaleReturn, BillingSettings, InventorySettings, PrinterSettings, SaleItem
from schemas.base import BaseResponse
from schemas.sales import SaleInitResponse, ProductSearchResponse, ProductSearchBatch, SaleReturnHistoryItem, SaleReturnHistoryPagedResponse
from api.deps import get_current_user, get_db
from core.config import settings

def send_to_printer(printer_settings, raw_bytes: bytes):
    """Send raw ESC/POS bytes to the configured thermal printer."""
    if not printer_settings:
        return
    port = printer_settings.ConnectionPort or "USB"
    if port.startswith("COM") or port.startswith("LPT"):
        with open(port, "wb") as f:
            f.write(raw_bytes)
    elif sys.platform == 'win32' and printer_settings.SelectedPrinterName:
        import win32print
        hprinter = win32print.OpenPrinter(printer_settings.SelectedPrinterName)
        try:
            win32print.StartDocPrinter(hprinter, 1, ("Receipt", None, "RAW"))
            win32print.StartPagePrinter(hprinter)
            win32print.WritePrinter(hprinter, raw_bytes)
            win32print.EndPagePrinter(hprinter)
            win32print.EndDocPrinter(hprinter)
        finally:
            win32print.ClosePrinter(hprinter)

router = APIRouter()

@router.get("/init", response_model=BaseResponse[SaleInitResponse], summary="Initialize a new POS sale")
def init_sale(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        billing_settings = db.query(BillingSettings).first()
        
        # Default fallback values
        invoice_no = f"INV-{datetime.now().strftime('%y%m')}-0001"
        default_tax_rate = 0.0
        max_discount = 0.0
        discount_enabled = False
        require_admin_pin = False
        admin_discount_threshold = 0.0
        default_payment = "Cash"
        auto_print = False
        show_shortcuts = True
        
        if billing_settings:
            # Generate Invoice Number from settings
            prefix = billing_settings.InvoicePrefix or "INV-"
            next_num = billing_settings.NextInvoiceNumber or 1
            
            while True:
                invoice_no = f"{prefix}{next_num}"
                if not db.query(Sale).filter(Sale.InvoiceNumber == invoice_no).first():
                    break
                next_num += 1
            
            if billing_settings.TaxEnabled:
                default_tax_rate = float(billing_settings.DefaultTaxRate)
            discount_enabled = bool(billing_settings.DiscountEnabled)
            if discount_enabled:
                max_discount = float(billing_settings.MaxDiscountPercentage)
            require_admin_pin = bool(billing_settings.RequireAdminPinForDiscount)
            admin_discount_threshold = float(billing_settings.AdminDiscountThreshold)
            
            default_payment = billing_settings.DefaultPaymentMethod or "Cash"
            auto_print = bool(billing_settings.AutoPrintReceipt)
            show_shortcuts = bool(billing_settings.ShowKeyboardShortcuts)

        data = SaleInitResponse(
            InvoiceNumber=invoice_no,
            DefaultTaxRate=default_tax_rate,
            MaxDiscountPercentage=max_discount,
            DiscountEnabled=discount_enabled,
            RequireAdminPinForDiscount=require_admin_pin,
            AdminDiscountThreshold=admin_discount_threshold,
            DefaultPaymentMethod=default_payment,
            AutoPrintReceipt=auto_print,
            ShowKeyboardShortcuts=show_shortcuts
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from sqlalchemy import case, desc

@router.get("/search-product", response_model=BaseResponse[List[ProductSearchResponse]], summary="Search medicines for POS with FEFO batches")
def search_product(
    q: Optional[str] = Query(None, min_length=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        if not q or q.strip() == "":
            # Top Selling Suggestions
            top_selling = db.query(
                Medicine,
                func.sum(SaleItem.Quantity).label('total_sold')
            ).join(
                StockBatch, StockBatch.MedicineId == Medicine.MedicineId
            ).join(
                SaleItem, SaleItem.BatchId == StockBatch.BatchId
            ).filter(
                Medicine.IsActive == True
            ).group_by(
                Medicine.MedicineId
            ).order_by(
                desc('total_sold')
            ).limit(10).all()
            
            medicines = [med for med, total in top_selling]
        else:
            q = q.strip()
            search_term = f"%{q}%"
            starts_with = f"{q}%"
            
            # Find medicines matching the query (Name, GenericName, or Barcode)
            # Prioritize those starting with the query
            medicines = db.query(Medicine).filter(
                Medicine.IsActive == True,
                or_(
                    Medicine.BrandName.ilike(search_term),
                    Medicine.GenericName.ilike(search_term),
                    Medicine.Barcode.ilike(search_term)
                )
            ).order_by(
                case(
                    (Medicine.BrandName.ilike(starts_with), 0),
                    (Medicine.GenericName.ilike(starts_with), 1),
                    else_=2
                ),
                Medicine.BrandName.asc()
            ).limit(30).all()

        
        inv_settings = db.query(InventorySettings).first()
        enable_fefo = inv_settings.EnableFefo if inv_settings else True
        prevent_expired = inv_settings.PreventSaleOfExpired if inv_settings else True
        today = datetime.now().date()

        results = []
        for med in medicines:
            # Get batches with available stock
            batch_query = db.query(StockBatch).filter(
                StockBatch.MedicineId == med.MedicineId,
                StockBatch.Quantity > 0
            )

            # Block expired batches from appearing in POS search if setting is ON
            if prevent_expired:
                batch_query = batch_query.filter(StockBatch.ExpiryDate > today)
            
            if enable_fefo:
                # FEFO: order by earliest expiry first
                batch_query = batch_query.order_by(StockBatch.ExpiryDate.asc())
            else:
                batch_query = batch_query.order_by(StockBatch.ReceivedDate.desc())
                
            batches = batch_query.all()

            if not batches:
                continue # Skip medicines with no available/valid stock

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
from decimal import Decimal

@router.post("/", response_model=BaseResponse[dict], summary="Complete a sale")
def complete_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        if not sale_data.Items:
            raise ValidationError("Cart is empty")

        current_date = dt.date.today()
        
        inv_settings = db.query(InventorySettings).first()
        prevent_expired = inv_settings.PreventSaleOfExpired if inv_settings else True
        allow_negative = inv_settings.AllowNegativeStock if inv_settings else False
        enable_fefo = inv_settings.EnableFefo if inv_settings else True

        # Create Sale Record
        billing_settings = db.query(BillingSettings).with_for_update().first()
        if billing_settings:
            prefix = billing_settings.InvoicePrefix or "INV-"
            next_num = billing_settings.NextInvoiceNumber or 1
            
            # Guard against UNIQUE constraint failures (out-of-sync NextInvoiceNumber)
            while True:
                invoice_no = f"{prefix}{next_num}"
                if not db.query(Sale).filter(Sale.InvoiceNumber == invoice_no).first():
                    break
                next_num += 1
                
            billing_settings.NextInvoiceNumber = next_num + 1
        else:
            current_year_month = datetime.now().strftime("%y%m")
            count = db.query(Sale).filter(Sale.InvoiceNumber.like(f"INV-{current_year_month}-%")).count()
            
            # Fallback guard
            while True:
                invoice_no = f"INV-{current_year_month}-{(count + 1):04d}"
                if not db.query(Sale).filter(Sale.InvoiceNumber == invoice_no).first():
                    break
                count += 1

        new_sale = Sale(
            CustomerId=sale_data.CustomerId,
            UserId=current_user.UserId,
            InvoiceNumber=invoice_no,
            SubTotal=sale_data.SubTotal,
            DiscountAmount=sale_data.DiscountAmount,
            TaxAmount=sale_data.TaxAmount,
            GrandTotal=sale_data.GrandTotal,
            NetAmount=sale_data.GrandTotal,
            PaidAmount=sale_data.PaidAmount,
            PaymentMethod=sale_data.PaymentMethod,
            Status="Completed" if sale_data.PaidAmount >= sale_data.GrandTotal else "Pending",
            PrescriptionRef=sale_data.PrescriptionRef
        )
        db.add(new_sale)
        db.flush() # To get SalesId

        for item in sale_data.Items:
            remaining_qty_to_fulfill = item.Quantity
            
            # Use specific BatchId if FEFO is not enabled, otherwise query all
            if not enable_fefo and item.BatchId:
                batch_query = db.query(StockBatch).filter(
                    StockBatch.MedicineId == item.MedicineId,
                    StockBatch.BatchId == item.BatchId
                )
            else:
                batch_query = db.query(StockBatch).filter(StockBatch.MedicineId == item.MedicineId)

            if prevent_expired:
                batch_query = batch_query.filter(StockBatch.ExpiryDate > current_date)
                
            if not allow_negative:
                batch_query = batch_query.filter(StockBatch.Quantity > 0)
                
            if enable_fefo:
                batch_query = batch_query.order_by(StockBatch.ExpiryDate.asc())
            else:
                batch_query = batch_query.order_by(StockBatch.ReceivedDate.desc())
                
            batches = batch_query.with_for_update().all()

            if not batches:
                if prevent_expired and not allow_negative:
                    # Check if blocked due to expiry and give a clear message
                    any_batch = db.query(StockBatch).filter(StockBatch.MedicineId == item.MedicineId, StockBatch.BatchId == item.BatchId).first()
                    if any_batch and any_batch.ExpiryDate and any_batch.ExpiryDate <= current_date:
                        raise ValidationError(f"Batch {any_batch.BatchCode} for medicine ID {item.MedicineId} is expired. Sale strictly prevented.")

                if allow_negative:
                    # Sub-case A: A specific batch was requested (e.g., FEFO off) — reuse it even if qty <= 0
                    specific_batch = None
                    if item.BatchId:
                        specific_batch = db.query(StockBatch).filter(
                            StockBatch.MedicineId == item.MedicineId,
                            StockBatch.BatchId == item.BatchId
                        ).with_for_update().first()

                    if specific_batch:
                        batches = [specific_batch]
                    else:
                        # Sub-case B: No batches exist at all for this medicine.
                        # Get or create exactly ONE persistent SYS-DEFAULT batch — never create duplicates.
                        sys_batch = db.query(StockBatch).filter(
                            StockBatch.MedicineId == item.MedicineId,
                            StockBatch.BatchCode == "SYS-DEFAULT"
                        ).with_for_update().first()

                        if not sys_batch:
                            sys_batch = StockBatch(
                                MedicineId=item.MedicineId,
                                BatchCode="SYS-DEFAULT",
                                Quantity=0,
                                CostPrice=0,
                                SellingPrice=item.UnitPrice,
                                ExpiryDate=current_date + dt.timedelta(days=365)
                            )
                            db.add(sys_batch)
                            db.flush()

                        batches = [sys_batch]
                else:
                    raise ValidationError(f"No valid stock available for medicine ID {item.MedicineId}")

            total_available = sum(b.Quantity for b in batches)
            if not allow_negative and total_available < remaining_qty_to_fulfill:
                raise ValidationError(f"Insufficient stock for medicine ID {item.MedicineId}. Requested {item.Quantity}, available {total_available}. Strict negative stock guard enforced.")

            # Cascade Deduction
            for idx, batch in enumerate(batches):
                if remaining_qty_to_fulfill <= 0:
                    break
                
                if allow_negative and idx == len(batches) - 1:
                    # Dump all remaining negative quantity into the last available batch
                    qty_from_this_batch = remaining_qty_to_fulfill
                else:
                    # Take up to what is available
                    qty_from_this_batch = min(max(batch.Quantity, 0), remaining_qty_to_fulfill)
                    if qty_from_this_batch == 0 and allow_negative:
                        continue
                
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

def _build_receipt_bytes(sale, ps, is_reprint: bool, billing_settings=None) -> bytes:
    """
    Build a complete ESC/POS byte sequence for a sale receipt.
    ps = PrinterSettings ORM object (may be None; falls back to safe defaults).
    Returns raw bytes ready to send to a thermal printer.
    """
    # ── ESC/POS constants ────────────────────────────────────────────────────
    ESC           = b'\x1b'
    GS            = b'\x1d'
    LF            = b'\x0a'
    INIT          = ESC + b'@'
    ALIGN_CENTER  = ESC + b'a\x01'
    ALIGN_LEFT    = ESC + b'a\x00'
    BOLD_ON       = ESC + b'E\x01'
    BOLD_OFF      = ESC + b'E\x00'
    DOUBLE_HEIGHT = ESC + b'!\x10'
    NORMAL_SIZE   = ESC + b'!\x00'
    CUT           = GS  + b'V\x00'

    # ── Settings with safe defaults ──────────────────────────────────────────
    cpl           = int(getattr(ps, 'CharactersPerLine', 42)) if ps else 42
    item_w        = int(getattr(ps, 'ItemNameWidth', 16))     if ps else 16
    separator     = ('-' * cpl + '\n').encode()

    def _get(attr, default):
        return getattr(ps, attr, default) if ps else default

    show_logo          = _get('ShowLogo',         True)
    show_pharm_name    = _get('ShowPharmacyName',  True)
    show_address       = _get('ShowAddress',       True)
    show_phone         = _get('ShowPhoneNumber',   True)
    show_license_ntn   = _get('PrintLicenseAndNtn', False)
    show_inv_no        = _get('ShowInvoiceNumber', True)
    show_date          = _get('ShowDate',          True)
    show_time          = _get('ShowTime',          True)
    show_cashier       = _get('ShowCashier',       True)
    show_customer      = _get('ShowCustomerName',  True)
    show_subtotal      = _get('ShowSubtotal',      True)
    show_discount      = _get('ShowDiscount',      True)
    show_tax           = _get('ShowTax',           True)
    show_paid          = _get('ShowAmountPaid',    True)
    show_change        = _get('ShowChangeDue',     True)
    show_pay_method    = _get('ShowPaymentMethod', True)
    autocut            = _get('AutoCutPaper',      True)
    receipt_title      = (_get('ReceiptTitle', 'SALE RECEIPT') or 'SALE RECEIPT').strip().upper()
    footer_msg         = _get('ReceiptFooterMessage', None)

    # ── Helper: right-align a KV line ────────────────────────────────────────
    def kv_line(label: str, value: str) -> bytes:
        val = str(value)
        pad = cpl - len(label) - len(val)
        if pad < 1:
            pad = 1
        return f"{label}{' ' * pad}{val}\n".encode()

    # ── Helper: safe word-wrap within a fixed width ───────────────────────────
    def wrap_text(text: str, width: int):
        """Return list of strings each <= width chars."""
        words = text.split()
        lines, current = [], ''
        for word in words:
            if len(current) + len(word) + (1 if current else 0) <= width:
                current = current + (' ' if current else '') + word
            else:
                if current:
                    lines.append(current)
                current = word[:width]
        if current:
            lines.append(current)
        return lines or ['']

    # ── Helper: truncate + pad name to fixed column width ────────────────────
    def fmt_name(name: str, width: int) -> str:
        if len(name) > width:
            name = name[:width - 1] + '~'
        return name.ljust(width)

    # ── Pharmacy profile data ─────────────────────────────────────────────────
    pharmacy_name    = (ps.PharmacyName if ps and ps.PharmacyName else 'PHARMACY')
    pharmacy_address = (ps.PharmacyAddress if ps and ps.PharmacyAddress else '')
    pharmacy_phone   = (ps.PharmacyPhone if ps and ps.PharmacyPhone else '')
    drug_license     = (ps.DrugLicenseNumber if ps and ps.DrugLicenseNumber else '')
    ntn_strn         = (ps.NtnStrn if ps and ps.NtnStrn else '')
    footer1          = footer_msg or 'Thank you for your visit!'
    footer2          = ''

    buf = bytearray()
    buf += INIT

    # ── HEADER ────────────────────────────────────────────────────────────────
    buf += ALIGN_CENTER
    if show_pharm_name:
        buf += BOLD_ON + DOUBLE_HEIGHT + f"{pharmacy_name}\n".encode() + NORMAL_SIZE + BOLD_OFF
    # Receipt title
    buf += BOLD_ON + f"{receipt_title}\n".encode() + BOLD_OFF
    if show_address and pharmacy_address:
        for ln in wrap_text(pharmacy_address, cpl):
            buf += f"{ln}\n".encode()
    if show_phone and pharmacy_phone:
        buf += f"Tel: {pharmacy_phone}\n".encode()
    if show_license_ntn:
        if drug_license:
            buf += f"Lic: {drug_license}\n".encode()
        if ntn_strn:
            buf += f"NTN/STRN: {ntn_strn}\n".encode()

    if is_reprint:
        buf += separator
        buf += BOLD_ON + b"* DUPLICATE / REPRINT *\n" + BOLD_OFF

    buf += separator

    # ── INVOICE INFO ──────────────────────────────────────────────────────────
    buf += ALIGN_LEFT
    tx_date = sale.TransactionDate.replace(tzinfo=timezone.utc).astimezone() if sale.TransactionDate else datetime.now()
    if show_inv_no:
        buf += f"Invoice : {sale.InvoiceNumber}\n".encode()
    if show_date:
        buf += f"Date    : {tx_date.strftime('%d-%b-%Y')}\n".encode()
    if show_time:
        buf += f"Time    : {tx_date.strftime('%I:%M %p')}\n".encode()
    customer_name = sale.customer.Name if sale.customer else 'Walk-in Customer'
    if show_customer:
        buf += f"Customer: {customer_name}\n".encode()
    if show_cashier and sale.user:
        cashier = sale.user.FullName or sale.user.Username
        buf += f"Cashier : {cashier}\n".encode()
    if show_pay_method:
        buf += f"Payment : {sale.PaymentMethod or 'Cash'}\n".encode()

    buf += separator

    # ── ITEMS TABLE ────────────────────────────────────────────────────────────
    # Column widths: name_w | qty(3) | price(7) | total(8) — all sum to cpl
    qty_w   = 3
    price_w = 7
    total_w = cpl - item_w - qty_w - price_w - 3  # 3 spaces separating cols
    if total_w < 5:
        total_w = 5

    header_row = (
        'Item'.ljust(item_w) + ' ' +
        'Qty'.rjust(qty_w)   + ' ' +
        'Price'.rjust(price_w) + ' ' +
        'Total'.rjust(total_w) + '\n'
    )
    buf += header_row.encode()
    buf += separator

    for item in sale.items:
        med_name = item.batch.medicine.BrandName if (item.batch and item.batch.medicine) else 'Unknown'
        qty_str   = str(item.Quantity).rjust(qty_w)
        price_str = f"{float(item.UnitPrice):.2f}".rjust(price_w)
        total_str = f"{float(item.TotalPrice):.2f}".rjust(total_w)

        # First line: name + numbers
        buf += (
            fmt_name(med_name, item_w) + ' ' +
            qty_str + ' ' + price_str + ' ' + total_str + '\n'
        ).encode()



        # Discount per item (if any)
        if item.Discount and float(item.Discount) > 0:
            disc_str = f"  Disc: -{float(item.Discount):.2f}"
            buf += disc_str.encode() + b'\n'

    buf += separator

    # ── TOTALS ─────────────────────────────────────────────────────────────────
    if show_subtotal:
        buf += kv_line("Subtotal:", f"{float(sale.SubTotal):.2f}")
    if show_discount and float(sale.DiscountAmount) > 0:
        buf += kv_line("Discount:", f"-{float(sale.DiscountAmount):.2f}")
    if show_tax and float(sale.TaxAmount) > 0:
        buf += kv_line("Tax:", f"{float(sale.TaxAmount):.2f}")

    buf += separator
    buf += BOLD_ON + kv_line("TOTAL:", f"{float(sale.GrandTotal):.2f}") + BOLD_OFF
    buf += separator

    if show_paid:
        buf += kv_line("Paid:", f"{float(sale.PaidAmount):.2f}")
    if show_change:
        change = max(0.0, float(sale.PaidAmount) - float(sale.GrandTotal))
        if change > 0:
            buf += kv_line("Change:", f"{change:.2f}")

    # ── FOOTER ────────────────────────────────────────────────────────────────
    buf += b'\n'
    buf += ALIGN_CENTER
    if footer1:
        for ln in wrap_text(footer1, cpl):
            buf += f"{ln}\n".encode()
    if footer2:
        for ln in wrap_text(footer2, cpl):
            buf += f"{ln}\n".encode()

    # Paper feed + cut
    buf += LF * 3
    if autocut:
        buf += CUT

    return bytes(buf)


@router.post("/{sales_id}/print-thermal", response_model=BaseResponse[dict], summary="Spool ESC/POS receipt for thermal printer")
def print_thermal_receipt(
    sales_id: int,
    is_reprint: bool = Query(False),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Build a settings-driven ESC/POS receipt and send it to the configured printer.
    This endpoint NEVER creates or modifies any sale, stock, or payment data.
    It is safe to call multiple times (reprint) without any side-effects.
    """
    try:
        sale = db.query(Sale).options(
            selectinload(Sale.items).selectinload(SaleItem.batch).selectinload(StockBatch.medicine),
            selectinload(Sale.customer),
            selectinload(Sale.user),
        ).filter(Sale.SalesId == sales_id).first()

        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        printer_settings = db.query(PrinterSettings).first()
        billing_settings = db.query(BillingSettings).first()

        # Build the full ESC/POS byte payload
        receipt_bytes = _build_receipt_bytes(
            sale, printer_settings, is_reprint, billing_settings
        )

        copies = int(getattr(printer_settings, 'Copies', 1) or 1)
        copies = max(1, min(copies, 5))  # clamp 1–5 for safety

        # ── Dispatch to printer (isolated — failure won't corrupt transaction) ──
        print_error = None
        for _ in range(copies):
            try:
                send_to_printer(printer_settings, receipt_bytes)
            except Exception as e:
                print_error = str(e)
                logger.error(f"Physical print failed for {sale.InvoiceNumber}: {e}")
                break  # don't retry bad hardware on the same job

        # ── Spooler: save latest bytes as fallback / audit ────────────────────
        try:
            spooler_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "spooler"
            )
            os.makedirs(spooler_dir, exist_ok=True)
            filename = f"{sale.InvoiceNumber}.bin"
            with open(os.path.join(spooler_dir, filename), 'wb') as f:
                f.write(receipt_bytes)
        except Exception as e:
            logger.warning(f"Spooler write failed for {sale.InvoiceNumber}: {e}")

        if print_error:
            return {
                "success": False,
                "data": {"message": f"Receipt built but hardware print failed: {print_error}"},
                "error": print_error
            }

        return {"success": True, "data": {"message": f"Printed {copies} copy/copies for {sale.InvoiceNumber}"}}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"print_thermal_receipt error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi", response_model=BaseResponse[dict], summary="Get Sales KPIs")
def get_sales_kpi(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        from datetime import datetime, timezone
        from models import SaleItem
        
        # Local start and end of today, converted to naive UTC for SQLite
        now = datetime.now()
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_today = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        start_utc = start_of_today.astimezone().astimezone(timezone.utc).replace(tzinfo=None)
        end_utc = end_of_today.astimezone().astimezone(timezone.utc).replace(tzinfo=None)
        
        # Today's Sales
        todays_sales = db.query(func.sum(Sale.NetAmount)).filter(
            Sale.TransactionDate >= start_utc,
            Sale.TransactionDate <= end_utc,
            Sale.Status == "Completed"
        ).scalar() or 0.0
        
        # Total Revenue (Today's PaidAmount)
        total_revenue = db.query(func.sum(Sale.PaidAmount)).filter(
            Sale.TransactionDate >= start_utc,
            Sale.TransactionDate <= end_utc,
            Sale.Status == "Completed"
        ).scalar() or 0.0
        
        # Total Invoices Today
        total_invoices = db.query(func.count(Sale.SalesId)).filter(
            Sale.TransactionDate >= start_utc,
            Sale.TransactionDate <= end_utc,
            Sale.Status == "Completed"
        ).scalar() or 0
        
        # Items Sold Today
        items_sold = db.query(func.sum(SaleItem.Quantity)).join(
            Sale, SaleItem.SalesId == Sale.SalesId
        ).filter(
            Sale.TransactionDate >= start_utc,
            Sale.TransactionDate <= end_utc,
            Sale.Status == "Completed"
        ).scalar() or 0
        
        # Pending Payments (All time)
        pending_payments = db.query(func.sum(Sale.GrandTotal - Sale.PaidAmount)).filter(
            Sale.GrandTotal > Sale.PaidAmount,
            Sale.Status == "Completed"
        ).scalar() or 0.0
        
        return {"success": True, "data": {
            "todaysSales": float(todays_sales),
            "totalRevenue": float(total_revenue),
            "totalInvoices": int(total_invoices),
            "itemsSoldToday": int(items_sold),
            "pendingPayments": float(pending_payments)
        }}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from schemas.sales import SaleHistoryItem, SaleHistoryPagedResponse
from models import Customer

@router.get("/history", response_model=BaseResponse[SaleHistoryPagedResponse], summary="Fetch sales history with advanced filtering")
def get_sales_history(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(15),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        query = db.query(Sale).options(
            joinedload(Sale.customer),
            joinedload(Sale.user),
            selectinload(Sale.items),
        )
        
        if start_date:
            try:
                sd = datetime.strptime(start_date, "%Y-%m-%d")
                sd_utc = sd.astimezone().astimezone(timezone.utc).replace(tzinfo=None)
                query = query.filter(Sale.TransactionDate >= sd_utc)
            except Exception as e:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
                ed_utc = ed.astimezone().astimezone(timezone.utc).replace(tzinfo=None)
                query = query.filter(Sale.TransactionDate <= ed_utc)
            except Exception as e:
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
            
        query = query.order_by(Sale.TransactionDate.desc())
        total_count = query.count()
        
        if page_size > 0:
            sales = query.offset((page - 1) * page_size).limit(page_size).all()
        else:
            sales = query.all()
        
        sale_ids = [sale.SalesId for sale in sales]
        returns_by_sale = {sale_id: [] for sale_id in sale_ids}
        if sale_ids:
            returns = db.query(SaleReturn).options(selectinload(SaleReturn.items)).filter(
                SaleReturn.SalesId.in_(sale_ids)
            ).all()
            for sale_return in returns:
                returns_by_sale[sale_return.SalesId].append(sale_return)

        results = []
        for sale in sales:
            total_items = sum(i.Quantity for i in sale.items)
            returned_items = 0
            for r in returns_by_sale[sale.SalesId]:
                returned_items += sum(ri.ReturnQuantity for ri in r.items)
                
            status = sale.Status
            if returned_items > 0:
                if returned_items >= total_items and total_items > 0:
                    status = "Fully Refunded"
                else:
                    status = "Partially Returned"
                    
            ret_amt = float(getattr(sale, "ReturnedAmount", 0) or 0)
            net_amt = float(sale.NetAmount) if (getattr(sale, "NetAmount", None) is not None and float(sale.NetAmount) > 0) else (float(sale.GrandTotal) - ret_amt)
            if ret_amt >= float(sale.GrandTotal) and float(sale.GrandTotal) > 0:
                net_amt = 0.0

            results.append(SaleHistoryItem(
                SalesId=sale.SalesId,
                InvoiceNumber=sale.InvoiceNumber,
                TransactionDate=utc_to_local_str(sale.TransactionDate),
                CustomerName=sale.customer.Name if sale.customer else "Walk-in",
                CashierName=sale.user.Username if sale.user else "Unknown",
                PaymentMethod=sale.PaymentMethod,
                GrandTotal=float(sale.GrandTotal),
                ReturnedAmount=ret_amt,
                NetAmount=net_amt,
                PaidAmount=float(sale.PaidAmount),
                Status=status
            ))
            
        return {
            "success": True, 
            "data": {
                "items": results,
                "total": total_count,
                "page": page,
                "page_size": page_size
            }
        }
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
            TransactionDate=utc_to_local_str(sale.TransactionDate),
            CustomerName=sale.customer.Name if sale.customer else "Walk-in",
            CustomerId=sale.CustomerId,
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
            RefundMode=return_data.RefundMode,
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
                
            # Refund = UnitPrice × ReturnQty (matches frontend)
            item_refund = float(orig_item.UnitPrice) * ret_item.ReturnQuantity
            total_refund += item_refund
            
            # Stock Update vs Quarantine
            batch = db.query(StockBatch).filter(StockBatch.BatchId == ret_item.BatchId).with_for_update().first()
            if not batch:
                raise ValidationError(f"Batch {ret_item.BatchId} no longer exists in inventory.")
                
            prev_qty = batch.Quantity

            if ret_item.ItemCondition == "Restockable":
                batch.Quantity += ret_item.ReturnQuantity
                # Record stock increase in StockAdjustment (shows in Stock Movement History)
                adjustment = StockAdjustment(
                    BatchId=batch.BatchId,
                    UserId=current_user.UserId,
                    AdjustmentType="Increase",
                    Quantity=ret_item.ReturnQuantity,
                    PreviousQuantity=prev_qty,
                    NewQuantity=batch.Quantity,
                    Reason=f"Sale Return (+) {ret_invoice_no}: {return_data.Reason}"
                )
                db.add(adjustment)
            elif ret_item.ItemCondition == "Damaged/Quarantine":
                # Write-off: log as decrease for tracking
                adjustment = StockAdjustment(
                    BatchId=batch.BatchId,
                    UserId=current_user.UserId,
                    AdjustmentType="Decrease",
                    Quantity=ret_item.ReturnQuantity,
                    PreviousQuantity=prev_qty,
                    NewQuantity=prev_qty,
                    Reason=f"Quarantine Write-off from Return {ret_invoice_no}: {return_data.Reason}"
                )
                db.add(adjustment)
            else:
                raise ValidationError(f"Invalid ItemCondition: {ret_item.ItemCondition}")
                
            ri = SaleReturnItem(
                ReturnId=new_return.ReturnId,
                BatchId=ret_item.BatchId,
                ReturnQuantity=ret_item.ReturnQuantity,
                RefundAmount=item_refund,
                ItemCondition=ret_item.ItemCondition,
                ReturnReason=ret_item.ReturnReason
            )
            db.add(ri)
            
            # Update original SaleItem
            orig_item.ReturnedQuantity += ret_item.ReturnQuantity
            
        new_return.TotalRefundAmount = total_refund
        
        # Update parent Sale
        sale.ReturnedAmount += Decimal(str(total_refund))
        sale.NetAmount -= Decimal(str(total_refund))
        if sale.NetAmount <= 0 and sale.GrandTotal > 0:
            sale.Status = 'Returned'


        # Customer Balance Credit
        if return_data.RefundMode == "Balance" and sale.CustomerId:
            customer = db.query(Customer).filter(Customer.CustomerId == sale.CustomerId).with_for_update().first()
            if customer:
                customer.DueBalance = float(customer.DueBalance or 0) + total_refund
            else:
                raise ValidationError("Customer not found for balance adjustment.")
        elif return_data.RefundMode == "Balance" and not sale.CustomerId:
            raise ValidationError("Balance adjustment requires a registered customer.")
        
        # Audit Logging
        audit = AuditLog(
            UserId=current_user.UserId,
            Action="Sale Return Processed",
            Description=f"Processed return {ret_invoice_no} for Sale {sale.InvoiceNumber}. Refund: {total_refund:.2f}. Mode: {return_data.RefundMode}. Reason: {return_data.Reason}"
        )
        db.add(audit)
        
        # Spool Thermal Receipt for Return
        try:
            import os
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
            bytes_data += ALIGN_CENTER + BOLD_ON + b"PHARMACY MANAGEMENT SYSTEM\n" + BOLD_OFF
            bytes_data += b"*** RETURN RECEIPT ***\n\n"
            bytes_data += ALIGN_LEFT
            bytes_data += f"Return No: {ret_invoice_no}\n".encode()
            bytes_data += f"Invoice No : {sale.InvoiceNumber}\n".encode()
            bytes_data += f"Date     : {datetime.now().strftime('%d/%m/%Y, %I:%M %p')}\n".encode()
            bytes_data += f"Customer : {sale.customer.Name if sale.customer else 'Walk-in'}\n".encode()
            bytes_data += b"------------------------------------------\n"
            for ret_item in return_data.Items:
                if ret_item.ReturnQuantity <= 0: continue
                orig_item = original_items.get(ret_item.BatchId)
                if not orig_item: continue
                med_name = orig_item.batch.medicine.BrandName if orig_item.batch and orig_item.batch.medicine else "Unknown"
                bytes_data += f"{med_name}\n".encode()
                qty_price = f"  {ret_item.ReturnQuantity} x {float(orig_item.UnitPrice):.2f}"
                total_str = f"{float(orig_item.UnitPrice) * ret_item.ReturnQuantity:.2f}"
                spaces = 42 - len(qty_price) - len(total_str)
                bytes_data += f"{qty_price}{' ' * max(1, spaces)}{total_str}\n".encode()
            bytes_data += b"------------------------------------------\n"
            refund_str = f"{total_refund:.2f}"
            bytes_data += BOLD_ON + f"REFUND TOTAL:{' ' * max(1, 42 - 13 - len(refund_str))}{refund_str}\n".encode() + BOLD_OFF
            bytes_data += f"Mode: {return_data.RefundMode}\n".encode()
            bytes_data += LF * 4 + CUT
            
            # Send to physical printer
            printer_settings = db.query(PrinterSettings).first()
            try:
                send_to_printer(printer_settings, bytes(bytes_data))
            except Exception as print_e:
                logger.error(f"Physical print failed for return {ret_invoice_no}: {print_e}")

            spooler_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "spooler")
            os.makedirs(spooler_dir, exist_ok=True)
            with open(os.path.join(spooler_dir, f"{ret_invoice_no}.bin"), 'wb') as f:
                f.write(bytes_data)
        except Exception as print_e:
            print(f"Error spooling return receipt: {print_e}")
        
        db.commit()
        return {"success": True, "data": {"ReturnInvoiceNumber": ret_invoice_no, "RefundAmount": total_refund}}
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/return-history", response_model=BaseResponse[SaleReturnHistoryPagedResponse], summary="Get paginated sales returns history")
def get_return_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        total = db.query(func.count(SaleReturn.ReturnId)).scalar() or 0
        returns = (
            db.query(SaleReturn)
            .order_by(SaleReturn.ReturnDate.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        items = []
        for r in returns:
            customer_name = r.sale.customer.Name if r.sale and r.sale.customer else "Walk-in"
            original_inv = r.sale.InvoiceNumber if r.sale else "N/A"
            items.append(SaleReturnHistoryItem(
                ReturnId=r.ReturnId,
                ReturnInvoiceNumber=r.ReturnInvoiceNumber,
                OriginalInvoiceNumber=original_inv,
                ReturnDate=utc_to_local_str(r.ReturnDate),
                CustomerName=customer_name,
                TotalRefundAmount=float(r.TotalRefundAmount),
                RefundMode=r.RefundMode or "Cash Refund",
                Reason=r.Reason or ""
            ))

        return {"success": True, "data": SaleReturnHistoryPagedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size
        )}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/return/{return_id}", response_model=BaseResponse[dict], summary="Get return details")
def get_return_details(
    return_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        ret = db.query(SaleReturn).filter(SaleReturn.ReturnId == return_id).first()
        if not ret:
            raise HTTPException(status_code=404, detail="Return not found")
            
        items_list = []
        for ri in ret.items:
            med_name = ri.batch.medicine.BrandName if ri.batch and ri.batch.medicine else "Unknown"
            items_list.append({
                "MedicineName": med_name,
                "BatchCode": ri.batch.BatchCode if ri.batch else "N/A",
                "ReturnQuantity": ri.ReturnQuantity,
                "RefundAmount": float(ri.RefundAmount),
                "ItemCondition": ri.ItemCondition,
                "ReturnReason": ri.ReturnReason
            })
            
        return {"success": True, "data": {
            "ReturnInvoiceNumber": ret.ReturnInvoiceNumber,
            "OriginalInvoiceNumber": ret.sale.InvoiceNumber if ret.sale else "N/A",
            "ReturnDate": utc_to_local_str(ret.ReturnDate),
            "CustomerName": ret.sale.customer.Name if ret.sale and ret.sale.customer else "Walk-in",
            "CashierName": ret.user.Username if ret.user else "Unknown",
            "TotalRefundAmount": float(ret.TotalRefundAmount),
            "RefundMode": ret.RefundMode,
            "Reason": ret.Reason,
            "Items": items_list
        }}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/return/{return_id}/print-thermal", response_model=BaseResponse[dict], summary="Print return receipt")
def print_return_thermal(
    return_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        ret = db.query(SaleReturn).filter(SaleReturn.ReturnId == return_id).first()
        if not ret:
            raise HTTPException(status_code=404, detail="Return not found")
            
        import os
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
        bytes_data += ALIGN_CENTER + BOLD_ON + b"PHARMACY MANAGEMENT SYSTEM\n" + BOLD_OFF
        bytes_data += b"*** RETURN RECEIPT (REPRINT) ***\n\n"
        bytes_data += ALIGN_LEFT
        bytes_data += f"Return No: {ret.ReturnInvoiceNumber}\n".encode()
        bytes_data += f"Orig Inv : {ret.sale.InvoiceNumber if ret.sale else 'N/A'}\n".encode()
        bytes_data += f"Date     : {utc_to_local_str(ret.ReturnDate)}\n".encode()
        bytes_data += b"------------------------------------------\n"
        
        for ri in ret.items:
            if ri.ReturnQuantity <= 0: continue
            med_name = ri.batch.medicine.BrandName if ri.batch and ri.batch.medicine else "Unknown"
            bytes_data += f"{med_name}\n".encode()
            
            orig_unit_price = float(ri.RefundAmount) / ri.ReturnQuantity if ri.ReturnQuantity > 0 else 0
            qty_price = f"  {ri.ReturnQuantity} x {orig_unit_price:.2f}"
            total_str = f"{float(ri.RefundAmount):.2f}"
            spaces = 42 - len(qty_price) - len(total_str)
            bytes_data += f"{qty_price}{' ' * max(1, spaces)}{total_str}\n".encode()
            
        bytes_data += b"------------------------------------------\n"
        refund_str = f"{float(ret.TotalRefundAmount):.2f}"
        bytes_data += BOLD_ON + f"REFUND TOTAL:{' ' * max(1, 42 - 13 - len(refund_str))}{refund_str}\n".encode() + BOLD_OFF
        bytes_data += f"Mode: {ret.RefundMode}\n".encode()
        bytes_data += LF * 4 + CUT
        
        # Send to physical printer
        printer_settings = db.query(PrinterSettings).first()
        try:
            send_to_printer(printer_settings, bytes(bytes_data))
        except Exception as e:
            logger.error(f"Physical print failed for return {ret.ReturnInvoiceNumber}: {e}")
        
        spooler_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "spooler")
        os.makedirs(spooler_dir, exist_ok=True)
        with open(os.path.join(spooler_dir, f"{ret.ReturnInvoiceNumber}.bin"), 'wb') as f:
            f.write(bytes_data)
            
        return {"success": True, "data": {"message": "Receipt spooled successfully"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
