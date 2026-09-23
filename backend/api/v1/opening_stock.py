"""Opening Stock API

All endpoints are admin-only (enforced by router-level dependency).

Endpoints:
  GET  /opening-stock/template          — Download CSV/XLSX template with live medicine list
  POST /opening-stock/preview           — Dry-run: validate, compute idempotency token
  POST /opening-stock/import            — Parse uploaded CSV/XLSX → return preview rows
  POST /opening-stock                   — Commit session
  GET  /opening-stock                   — List sessions (paginated)
  GET  /opening-stock/{entry_id}        — Session detail with items
  POST /opening-stock/{entry_id}/void   — Safe atomic void
"""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, subqueryload

from api.deps import get_current_admin_user, get_db
from models import (
    AuditLog,
    Medicine,
    OpeningStockEntry,
    OpeningStockItem,
    SaleItem,
    StockAdjustment,
    StockBatch,
)
from schemas.opening_stock import (
    OpeningStockCreate,
    OpeningStockEntryResponse,
    OpeningStockEntrySummary,
    OpeningStockItemResponse,
    OpeningStockLineItem,
    OpeningStockPreviewItem,
    OpeningStockPreviewRequest,
    OpeningStockPreviewResponse,
    compute_payload_hash,
    normalize_batch_code,
)

# All routes require admin — no cashier access to any endpoint including GETs
router = APIRouter(dependencies=[Depends(get_current_admin_user)])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_reference_no(db: Session) -> str:
    """Generate a unique OS-YYYYMMDD-NNN reference."""
    today_str = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"OS-{today_str}-"
    existing = (
        db.query(OpeningStockEntry)
        .filter(OpeningStockEntry.ReferenceNo.like(f"{prefix}%"))
        .count()
    )
    seq = existing + 1
    # retry until unique
    for _ in range(100):
        candidate = f"{prefix}{seq:03d}"
        if not db.query(OpeningStockEntry).filter(OpeningStockEntry.ReferenceNo == candidate).first():
            return candidate
        seq += 1
    raise RuntimeError("Could not generate a unique reference number")


def _resolve_medicine(db: Session, medicine_id: int) -> Medicine | None:
    return (
        db.query(Medicine)
        .filter(Medicine.MedicineId == medicine_id, Medicine.IsActive == True)
        .first()
    )


def _batch_exists(db: Session, medicine_id: int, batch_code: str) -> StockBatch | None:
    """Check for any existing batch with this (MedicineId, normalized BatchCode)."""
    return (
        db.query(StockBatch)
        .filter(
            StockBatch.MedicineId == medicine_id,
            func.upper(func.trim(StockBatch.BatchCode)) == batch_code.strip().upper(),
        )
        .first()
    )


def _validate_item(
    db: Session,
    item: OpeningStockLineItem,
    seen_keys: set,
) -> OpeningStockPreviewItem:
    """
    Validate a single line item for preview.
    Returns an OpeningStockPreviewItem with Error/Warning set if applicable.
    """
    normalized_code = normalize_batch_code(item.BatchCode)
    key = (item.MedicineId, normalized_code)

    error: Optional[str] = None

    # 1. Duplicate within this session
    if key in seen_keys:
        error = f"Duplicate: Medicine ID {item.MedicineId} + Batch '{normalized_code}' appears more than once in this session."
        medicine_name = f"Medicine #{item.MedicineId}"
        return OpeningStockPreviewItem(
            MedicineId=item.MedicineId,
            MedicineName=medicine_name,
            BatchCode=normalized_code,
            Quantity=item.Quantity,
            CostPrice=item.CostPrice,
            SellingPrice=item.SellingPrice,
            ExpiryDate=item.ExpiryDate,
            ManufacturingDate=item.ManufacturingDate,
            Error=error,
        )
    seen_keys.add(key)

    # 2. Medicine must exist and be active
    medicine = _resolve_medicine(db, item.MedicineId)
    if not medicine:
        return OpeningStockPreviewItem(
            MedicineId=item.MedicineId,
            MedicineName=f"Unknown #{item.MedicineId}",
            BatchCode=normalized_code,
            Quantity=item.Quantity,
            CostPrice=item.CostPrice,
            SellingPrice=item.SellingPrice,
            ExpiryDate=item.ExpiryDate,
            ManufacturingDate=item.ManufacturingDate,
            Error=f"Medicine ID {item.MedicineId} does not exist or is inactive.",
        )

    # 3. Batch must not already exist in DB (HARD BLOCK)
    existing = _batch_exists(db, item.MedicineId, normalized_code)
    if existing:
        return OpeningStockPreviewItem(
            MedicineId=item.MedicineId,
            MedicineName=medicine.BrandName,
            BatchCode=normalized_code,
            Quantity=item.Quantity,
            CostPrice=item.CostPrice,
            SellingPrice=item.SellingPrice,
            ExpiryDate=item.ExpiryDate,
            ManufacturingDate=item.ManufacturingDate,
            Error=(
                f"Batch '{normalized_code}' already exists in inventory for '{medicine.BrandName}'. "
                "Use Stock Adjustment to modify its quantity."
            ),
        )

    return OpeningStockPreviewItem(
        MedicineId=item.MedicineId,
        MedicineName=medicine.BrandName,
        BatchCode=normalized_code,
        Quantity=item.Quantity,
        CostPrice=item.CostPrice,
        SellingPrice=item.SellingPrice,
        ExpiryDate=item.ExpiryDate,
        ManufacturingDate=item.ManufacturingDate,
    )


def _parse_csv_bytes(content: bytes) -> list[dict]:
    """Parse CSV bytes into a list of dicts."""
    text = content.decode("utf-8-sig").strip()
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def _parse_xlsx_bytes(content: bytes) -> list[dict]:
    """Parse XLSX bytes into a list of dicts (requires openpyxl)."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    headers = [str(cell.value).strip() if cell.value is not None else "" for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        row_dict = dict(zip(headers, row))
        # skip entirely empty rows
        if all(v is None or str(v).strip() == "" for v in row_dict.values()):
            continue
        rows.append(row_dict)
    return rows


def _rows_to_line_items(rows: list[dict]) -> tuple[list[OpeningStockLineItem], list[str]]:
    """
    Convert parsed CSV/XLSX rows to OpeningStockLineItem objects.
    Returns (items, row_errors) where row_errors are parse failures.
    """
    items: list[OpeningStockLineItem] = []
    errors: list[str] = []

    for idx, row in enumerate(rows, start=2):  # row 1 = header
        def get(key: str) -> str:
            for k, v in row.items():
                if k.strip().lower() == key.lower():
                    return str(v).strip() if v is not None else ""
            return ""

        try:
            medicine_id_raw = get("Medicine ID") or get("MedicineId")
            if not medicine_id_raw:
                errors.append(f"Row {idx}: 'Medicine ID' is required.")
                continue
            medicine_id = int(medicine_id_raw)

            batch_code = get("Batch Number") or get("BatchCode") or get("Batch No")
            if not batch_code.strip():
                errors.append(f"Row {idx}: 'Batch Number' is required.")
                continue

            qty_raw = get("Quantity")
            if not qty_raw:
                errors.append(f"Row {idx}: 'Quantity' is required.")
                continue
            quantity = int(float(qty_raw))
            if quantity <= 0:
                errors.append(f"Row {idx}: Quantity must be > 0.")
                continue

            cost_raw = get("Cost Price") or get("CostPrice")
            selling_raw = get("Selling Price") or get("SellingPrice")
            if not cost_raw:
                errors.append(f"Row {idx}: 'Cost Price' is required.")
                continue
            if not selling_raw:
                errors.append(f"Row {idx}: 'Selling Price' is required.")
                continue
            cost = Decimal(str(cost_raw).replace(",", "").strip())
            selling = Decimal(str(selling_raw).replace(",", "").strip())

            expiry_raw = get("Expiry Date") or get("ExpiryDate")
            if not expiry_raw:
                errors.append(f"Row {idx}: 'Expiry Date' is required.")
                continue
            # Accept YYYY-MM-DD or DD/MM/YYYY
            try:
                expiry_date = date.fromisoformat(str(expiry_raw).strip()[:10])
            except ValueError:
                try:
                    expiry_date = datetime.strptime(str(expiry_raw).strip(), "%d/%m/%Y").date()
                except ValueError:
                    errors.append(f"Row {idx}: Invalid Expiry Date '{expiry_raw}'. Use YYYY-MM-DD.")
                    continue

            mfg_date: Optional[date] = None
            mfg_raw = get("Manufacturing Date") or get("ManufacturingDate")
            if mfg_raw and mfg_raw.lower() not in ("", "none", "n/a", "-"):
                try:
                    mfg_date = date.fromisoformat(str(mfg_raw).strip()[:10])
                except ValueError:
                    try:
                        mfg_date = datetime.strptime(str(mfg_raw).strip(), "%d/%m/%Y").date()
                    except ValueError:
                        errors.append(f"Row {idx}: Invalid Manufacturing Date '{mfg_raw}'. Use YYYY-MM-DD or leave blank.")
                        continue
                if mfg_date and mfg_date > expiry_date:
                    errors.append(f"Row {idx}: Manufacturing Date must be on or before Expiry Date.")
                    continue

            items.append(
                OpeningStockLineItem(
                    MedicineId=medicine_id,
                    BatchCode=batch_code,
                    Quantity=quantity,
                    CostPrice=cost,
                    SellingPrice=selling,
                    ExpiryDate=expiry_date,
                    ManufacturingDate=mfg_date,
                )
            )
        except (ValueError, InvalidOperation) as exc:
            errors.append(f"Row {idx}: Parse error — {exc}")

    return items, errors


# ─────────────────────────────────────────────────────────────────────────────
# Template download
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/template", summary="Download Opening Stock CSV or XLSX template with active medicines")
def download_template(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Returns a CSV or XLSX template pre-filled with all active medicines.
    Medicine ID + Name columns are read-only hints; the user fills the rest.
    """
    medicines = (
        db.query(Medicine)
        .filter(Medicine.IsActive == True)
        .order_by(Medicine.BrandName)
        .all()
    )

    headers = [
        "Medicine ID",
        "Medicine Name",
        "Batch Number",
        "Quantity",
        "Cost Price",
        "Selling Price",
        "Expiry Date (YYYY-MM-DD)",
        "Manufacturing Date (YYYY-MM-DD)",
    ]

    rows = [
        [
            med.MedicineId,
            med.BrandName,
            "",   # Batch Number — to be filled
            "",   # Quantity
            "",   # Cost Price
            "",   # Selling Price
            "",   # Expiry Date
            "",   # Manufacturing Date (optional)
        ]
        for med in medicines
    ]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        csv_bytes = output.getvalue().encode("utf-8-sig")
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=opening_stock_template.csv"},
        )

    # XLSX
    import openpyxl
    from openpyxl.styles import Font, PatternFill

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Opening Stock"

    # Header row
    ws.append(headers)
    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    # Data rows
    for row in rows:
        ws.append(row)

    # Column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_len + 4, 18)

    xlsx_bytes = io.BytesIO()
    wb.save(xlsx_bytes)
    xlsx_bytes.seek(0)

    return StreamingResponse(
        xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=opening_stock_template.xlsx"},
    )


@router.get("/export", summary="Export existing Opening Stock records")
def export_opening_stock(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Exports all Opening Stock line items in a format compatible with the import template.
    """
    items = (
        db.query(OpeningStockItem)
        .join(Medicine, OpeningStockItem.MedicineId == Medicine.MedicineId)
        .order_by(Medicine.BrandName, OpeningStockItem.BatchCode)
        .all()
    )

    headers = [
        "Medicine ID",
        "Medicine Name",
        "Batch Number",
        "Quantity",
        "Cost Price",
        "Selling Price",
        "Expiry Date (YYYY-MM-DD)",
        "Manufacturing Date (YYYY-MM-DD)",
    ]

    rows = []
    for item in items:
        # We need to fetch the Medicine explicitly if relationship is not eagerly loaded
        # The query joined it, but item.Medicine requires the relationship to be defined.
        # It's safer to query the tuple if we want the brand name.
        pass # Let's rewrite the query to return tuple (OpeningStockItem, BrandName)

    # Re-querying to ensure we get BrandName safely
    query_results = (
        db.query(OpeningStockItem, Medicine.BrandName)
        .join(Medicine, OpeningStockItem.MedicineId == Medicine.MedicineId)
        .order_by(Medicine.BrandName, OpeningStockItem.BatchCode)
        .all()
    )

    for item, brand_name in query_results:
        rows.append([
            item.MedicineId,
            brand_name,
            item.BatchCode,
            item.Quantity,
            item.CostPrice,
            item.SellingPrice,
            item.ExpiryDate.isoformat() if item.ExpiryDate else "",
            item.ManufacturingDate.isoformat() if item.ManufacturingDate else "",
        ])

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        csv_bytes = output.getvalue().encode("utf-8-sig")
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=opening_stock_export.csv"},
        )

    # XLSX
    import openpyxl
    from openpyxl.styles import Font, PatternFill

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Opening Stock Export"

    # Header row
    ws.append(headers)
    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    # Data rows
    for row in rows:
        ws.append(row)

    # Column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_len + 4, 18)

    xlsx_bytes = io.BytesIO()
    wb.save(xlsx_bytes)
    xlsx_bytes.seek(0)

    return StreamingResponse(
        xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=opening_stock_export.xlsx"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Preview (dry-run)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/preview", summary="Validate items and receive idempotency token (dry-run, no writes)")
def preview_opening_stock(
    request: OpeningStockPreviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Validates all items and returns per-row errors/warnings.
    Returns an idempotency_token that must be sent with /opening-stock to commit.
    No data is written.
    """
    seen_keys: set = set()
    preview_items: list[OpeningStockPreviewItem] = []

    for item in request.items:
        validated = _validate_item(db, item, seen_keys)
        preview_items.append(validated)

    has_errors = any(p.Error for p in preview_items)
    token = compute_payload_hash(request.items)

    total_value = sum(
        Decimal(str(p.Quantity)) * p.CostPrice
        for p in preview_items
        if not p.Error
    )

    return {
        "success": True,
        "data": OpeningStockPreviewResponse(
            idempotency_token=token,
            items=preview_items,
            has_errors=has_errors,
            total_items=len(preview_items),
            total_value=total_value,
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Import CSV/XLSX (parse only, return for preview)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import", summary="Parse uploaded CSV/XLSX and return rows for preview")
async def import_opening_stock_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Parses the uploaded file and returns rows in the same format as /preview.
    No data is written; the client must call /preview then /opening-stock to commit.
    """
    content = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith(".xlsx"):
        try:
            raw_rows = _parse_xlsx_bytes(content)
        except Exception as exc:
            raise HTTPException(400, f"Could not parse Excel file: {exc}")
    elif filename.lower().endswith(".csv"):
        try:
            raw_rows = _parse_csv_bytes(content)
        except Exception as exc:
            raise HTTPException(400, f"Could not parse CSV file: {exc}")
    else:
        raise HTTPException(400, "Only .csv and .xlsx files are supported.")

    if not raw_rows:
        raise HTTPException(400, "File is empty or has no data rows.")

    items, parse_errors = _rows_to_line_items(raw_rows)

    return {
        "success": True,
        "data": {
            "filename": filename,
            "total_rows": len(raw_rows),
            "parsed_items": [i.dict() for i in items],
            "parse_errors": parse_errors,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Commit
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", summary="Commit an Opening Stock session")
def commit_opening_stock(
    payload: OpeningStockCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Atomically commits the Opening Stock session.
    Requires idempotency_token from /preview.
    All validations are re-run inside the transaction.
    SQLite IntegrityError caught for concurrent double-submit protection.
    """
    # 1. Verify the idempotency token matches the submitted items
    expected_hash = compute_payload_hash(payload.items)
    if payload.idempotency_token != expected_hash:
        raise HTTPException(
            422,
            "Idempotency token does not match the submitted items. "
            "Please run /preview again and use the returned token.",
        )

    # 2. Check for duplicate session by hash (catches double-submit and re-import)
    if payload.idempotency_token:
        existing_entry = (
            db.query(OpeningStockEntry)
            .filter(OpeningStockEntry.ImportHash == payload.idempotency_token)
            .first()
        )
        if existing_entry:
            raise HTTPException(
                409,
                f"This Opening Stock payload was already committed as session "
                f"'{existing_entry.ReferenceNo}' on {existing_entry.EntryDate.strftime('%Y-%m-%d')}. "
                "No duplicate session created.",
            )

    # 3. Re-validate all items inside the transaction
    seen_keys: set = set()
    for item in payload.items:
        normalized_code = normalize_batch_code(item.BatchCode)
        key = (item.MedicineId, normalized_code)

        if key in seen_keys:
            raise HTTPException(
                422,
                f"Duplicate batch in session: Medicine ID {item.MedicineId} + Batch '{normalized_code}'.",
            )
        seen_keys.add(key)

        medicine = _resolve_medicine(db, item.MedicineId)
        if not medicine:
            raise HTTPException(
                422, f"Medicine ID {item.MedicineId} does not exist or is inactive."
            )

        existing_batch = _batch_exists(db, item.MedicineId, normalized_code)
        if existing_batch:
            raise HTTPException(
                409,
                f"Batch '{normalized_code}' already exists for '{medicine.BrandName}'. "
                "Use Stock Adjustment to change its quantity.",
            )

    # 4. Commit atomically
    try:
        reference_no = _generate_reference_no(db)

        total_value = sum(
            Decimal(str(item.Quantity)) * item.CostPrice for item in payload.items
        )

        entry = OpeningStockEntry(
            ReferenceNo=reference_no,
            ImportHash=payload.idempotency_token,
            Notes=payload.Notes,
            CreatedBy=current_user.UserId,
            TotalItems=len(payload.items),
            TotalValue=total_value,
            Status="ACTIVE",
        )
        db.add(entry)
        db.flush()  # get EntryId

        for item in payload.items:
            normalized_code = normalize_batch_code(item.BatchCode)

            # Create StockBatch — Source='OPENING_STOCK' marks this as opening stock
            new_batch = StockBatch(
                MedicineId=item.MedicineId,
                BatchCode=normalized_code,
                Quantity=item.Quantity,
                CostPrice=item.CostPrice,
                SellingPrice=item.SellingPrice,
                ManufacturingDate=item.ManufacturingDate,
                ExpiryDate=item.ExpiryDate,
                Source="OPENING_STOCK",
            )
            db.add(new_batch)
            db.flush()  # get BatchId

            # Record in opening_stock_items for session tracking & void checks
            os_item = OpeningStockItem(
                EntryId=entry.EntryId,
                BatchId=new_batch.BatchId,
                MedicineId=item.MedicineId,
                BatchCode=normalized_code,
                Quantity=item.Quantity,
                CostPrice=item.CostPrice,
                SellingPrice=item.SellingPrice,
                ExpiryDate=item.ExpiryDate,
                ManufacturingDate=item.ManufacturingDate,
            )
            db.add(os_item)

            # Write StockAdjustment — this is the ONLY movement record.
            # Reason prefix "OPENING_STOCK:{reference_no}" causes get_stock_movements()
            # to classify it as "Opening Stock" movement type instead of "Stock Adjustment".
            adj = StockAdjustment(
                BatchId=new_batch.BatchId,
                UserId=current_user.UserId,
                AdjustmentType="Increase",
                Quantity=item.Quantity,
                PreviousQuantity=0,
                NewQuantity=item.Quantity,
                Reason=f"OPENING_STOCK:{reference_no}",
            )
            db.add(adj)

        # Audit log
        db.add(
            AuditLog(
                UserId=current_user.UserId,
                Action="OPENING_STOCK_ENTRY",
                Description=(
                    f"Opening Stock session {reference_no} committed: "
                    f"{len(payload.items)} batches, total value {total_value}."
                ),
            )
        )

        db.commit()

        return {
            "success": True,
            "message": f"Opening Stock session {reference_no} committed successfully.",
            "data": {"EntryId": entry.EntryId, "ReferenceNo": reference_no},
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            "A duplicate was detected during commit (possible concurrent request). "
            "Please refresh and retry.",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(500, str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# Edit session
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{entry_id}", summary="Edit an Opening Stock session")
def edit_opening_stock(
    entry_id: int,
    payload: OpeningStockCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Safely edits an active Opening Stock session.
    Allowed ONLY if NO items from the session have been sold or adjusted.
    """
    entry = db.query(OpeningStockEntry).filter(OpeningStockEntry.EntryId == entry_id).first()
    if not entry:
        raise HTTPException(404, "Opening Stock session not found.")
    if entry.Status != "ACTIVE":
        raise HTTPException(409, f"Session '{entry.ReferenceNo}' is not active and cannot be edited.")

    # 1. Pre-flight safety checks on ALL existing batches in this session
    old_items_map = {}
    for osi in entry.items:
        batch = db.query(StockBatch).filter(StockBatch.BatchId == osi.BatchId).first()
        if not batch:
            raise HTTPException(409, f"Batch ID {osi.BatchId} not found. Cannot edit.")
        
        # Check sales
        sale_count = db.query(SaleItem).filter(SaleItem.BatchId == osi.BatchId).count()
        if sale_count > 0:
            raise HTTPException(409, f"Cannot edit: sales recorded from batch '{osi.BatchCode}'.")
            
        # Check adjustments
        adj_count = db.query(StockAdjustment).filter(StockAdjustment.BatchId == osi.BatchId).count()
        if adj_count != 1:
            raise HTTPException(409, f"Cannot edit: batch '{osi.BatchCode}' has stock adjustments beyond creation.")
            
        if batch.Quantity != osi.Quantity:
            raise HTTPException(409, f"Cannot edit: batch '{osi.BatchCode}' quantity changed.")
            
        old_items_map[(osi.MedicineId, osi.BatchCode.upper())] = (osi, batch)

    # 2. Check for duplicate payload batches
    seen_keys: set = set()
    for item in payload.items:
        normalized_code = normalize_batch_code(item.BatchCode)
        key = (item.MedicineId, normalized_code)
        if key in seen_keys:
            raise HTTPException(422, f"Duplicate batch in session payload: Medicine ID {item.MedicineId} + Batch '{normalized_code}'.")
        seen_keys.add(key)
        
        if key not in old_items_map:
            medicine = _resolve_medicine(db, item.MedicineId)
            if not medicine:
                raise HTTPException(422, f"Medicine ID {item.MedicineId} does not exist or is inactive.")
            existing_batch = _batch_exists(db, item.MedicineId, normalized_code)
            if existing_batch:
                raise HTTPException(409, f"Batch '{normalized_code}' already exists outside this session.")

    try:
        # 3. Apply updates
        for item in payload.items:
            normalized_code = normalize_batch_code(item.BatchCode)
            key = (item.MedicineId, normalized_code)
            
            if key in old_items_map:
                osi, batch = old_items_map.pop(key)
                # Update Batch
                batch.Quantity = item.Quantity
                batch.CostPrice = item.CostPrice
                batch.SellingPrice = item.SellingPrice
                batch.ExpiryDate = item.ExpiryDate
                batch.ManufacturingDate = item.ManufacturingDate
                
                # Update OSI
                osi.Quantity = item.Quantity
                osi.CostPrice = item.CostPrice
                osi.SellingPrice = item.SellingPrice
                osi.ExpiryDate = item.ExpiryDate
                osi.ManufacturingDate = item.ManufacturingDate
                
                # Update original Adjustment
                adj = db.query(StockAdjustment).filter(
                    StockAdjustment.BatchId == batch.BatchId,
                    StockAdjustment.Reason == f"OPENING_STOCK:{entry.ReferenceNo}"
                ).first()
                if adj:
                    adj.Quantity = item.Quantity
                    adj.NewQuantity = item.Quantity
            else:
                # Insert New
                new_batch = StockBatch(
                    MedicineId=item.MedicineId,
                    BatchCode=normalized_code,
                    Quantity=item.Quantity,
                    CostPrice=item.CostPrice,
                    SellingPrice=item.SellingPrice,
                    ManufacturingDate=item.ManufacturingDate,
                    ExpiryDate=item.ExpiryDate,
                    Source="OPENING_STOCK",
                )
                db.add(new_batch)
                db.flush()
                
                db.add(OpeningStockItem(
                    EntryId=entry.EntryId,
                    BatchId=new_batch.BatchId,
                    MedicineId=item.MedicineId,
                    BatchCode=normalized_code,
                    Quantity=item.Quantity,
                    CostPrice=item.CostPrice,
                    SellingPrice=item.SellingPrice,
                    ExpiryDate=item.ExpiryDate,
                    ManufacturingDate=item.ManufacturingDate,
                ))
                
                db.add(StockAdjustment(
                    BatchId=new_batch.BatchId,
                    UserId=current_user.UserId,
                    AdjustmentType="Increase",
                    Quantity=item.Quantity,
                    PreviousQuantity=0,
                    NewQuantity=item.Quantity,
                    Reason=f"OPENING_STOCK:{entry.ReferenceNo}",
                ))

        # 4. Handle removed items
        for key, (osi, batch) in old_items_map.items():
            original_qty = batch.Quantity
            batch.Quantity = 0
            
            db.add(StockAdjustment(
                BatchId=batch.BatchId,
                UserId=current_user.UserId,
                AdjustmentType="Decrease",
                Quantity=original_qty,
                PreviousQuantity=original_qty,
                NewQuantity=0,
                Reason=f"VOID_OPENING_STOCK:{entry.ReferenceNo}"
            ))
            db.delete(osi)

        # 5. Update Entry
        total_value = sum(Decimal(str(item.Quantity)) * item.CostPrice for item in payload.items)
        entry.Notes = payload.Notes
        entry.TotalItems = len(payload.items)
        entry.TotalValue = total_value
        entry.ImportHash = payload.idempotency_token

        db.add(AuditLog(
            UserId=current_user.UserId,
            Action="OPENING_STOCK_EDIT",
            Description=f"Opening Stock session {entry.ReferenceNo} edited. Now has {entry.TotalItems} batches, total value {total_value}.",
        ))

        db.commit()

        return {
            "success": True,
            "message": f"Opening Stock session {entry.ReferenceNo} updated successfully.",
            "data": {"EntryId": entry.EntryId, "ReferenceNo": entry.ReferenceNo},
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A duplicate was detected during update. Please refresh and retry.")
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(500, str(exc))

# ─────────────────────────────────────────────────────────────────────────────
# List sessions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", summary="List Opening Stock sessions")
def list_opening_stock(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    total = db.query(OpeningStockEntry).count()
    entries = (
        db.query(OpeningStockEntry)
        .options(
            joinedload(OpeningStockEntry.created_by_user),
            subqueryload(OpeningStockEntry.items).joinedload(OpeningStockItem.medicine),
        )
        .order_by(OpeningStockEntry.EntryDate.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    data = []
    for e in entries:
        total_qty = 0
        med_list = []
        batch_list = []
        seen_meds = set()
        seen_batches = set()

        for item in (e.items or []):
            total_qty += item.Quantity or 0
            m_name = item.medicine.BrandName if item.medicine else "Unknown"
            if m_name not in seen_meds:
                seen_meds.add(m_name)
                med_list.append(m_name)
            if item.BatchCode and item.BatchCode not in seen_batches:
                seen_batches.add(item.BatchCode)
                batch_list.append(item.BatchCode)

        data.append(
            OpeningStockEntrySummary(
                EntryId=e.EntryId,
                ReferenceNo=e.ReferenceNo,
                EntryDate=e.EntryDate,
                CreatedByName=e.created_by_user.FullName if e.created_by_user else "Unknown",
                TotalItems=e.TotalItems,
                TotalQuantity=total_qty,
                TotalValue=e.TotalValue,
                ImportFile=e.ImportFile,
                Status=e.Status,
                Medicines=med_list,
                BatchCodes=batch_list,
            )
        )

    return {
        "success": True,
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Session detail
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{entry_id}", summary="Get Opening Stock session detail")
def get_opening_stock_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    entry = db.query(OpeningStockEntry).filter(OpeningStockEntry.EntryId == entry_id).first()
    if not entry:
        raise HTTPException(404, "Opening Stock session not found.")

    items_out = []
    total_qty = 0
    for osi in entry.items:
        total_qty += osi.Quantity or 0
        med_name = osi.medicine.BrandName if osi.medicine else "Unknown"
        items_out.append(
            OpeningStockItemResponse(
                ItemId=osi.ItemId,
                MedicineId=osi.MedicineId,
                MedicineName=med_name,
                BatchCode=osi.BatchCode,
                BatchId=osi.BatchId,
                Quantity=osi.Quantity,
                CostPrice=osi.CostPrice,
                SellingPrice=osi.SellingPrice,
                ExpiryDate=osi.ExpiryDate,
                ManufacturingDate=osi.ManufacturingDate,
            )
        )

    return {
        "success": True,
        "data": OpeningStockEntryResponse(
            EntryId=entry.EntryId,
            ReferenceNo=entry.ReferenceNo,
            Notes=entry.Notes,
            EntryDate=entry.EntryDate,
            CreatedByName=entry.created_by_user.FullName if entry.created_by_user else "Unknown",
            TotalItems=entry.TotalItems,
            TotalQuantity=total_qty,
            TotalValue=entry.TotalValue,
            ImportFile=entry.ImportFile,
            Status=entry.Status,
            VoidedAt=entry.VoidedAt,
            VoidedByName=entry.voided_by_user.FullName if entry.voided_by_user else None,
            items=items_out,
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Void
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{entry_id}/void", summary="Safely void an Opening Stock session")
def void_opening_stock(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Safe atomic void.

    Void is ONLY allowed when for EVERY batch in the session:
      1. No SaleItem rows reference this BatchId (no sales ever made)
      2. No additional StockAdjustment rows beyond the original creation row
      3. Current batch.Quantity exactly equals the original OpeningStockItem.Quantity

    If any condition fails → HTTP 409 with the specific blocking batch identified.
    On success: StockBatch.Quantity set to 0 (NOT deleted), StockAdjustment Decrease rows created,
    entry Status set to VOIDED.

    After void: admin must use Stock Adjustment to modify remaining stock.
    The original StockBatch rows and audit trail are permanently preserved.
    """
    entry = db.query(OpeningStockEntry).filter(OpeningStockEntry.EntryId == entry_id).first()
    if not entry:
        raise HTTPException(404, "Opening Stock session not found.")

    if entry.Status == "VOIDED":
        raise HTTPException(409, f"Session '{entry.ReferenceNo}' has already been voided.")

    if entry.Status != "ACTIVE":
        raise HTTPException(409, f"Session '{entry.ReferenceNo}' is not active and cannot be voided.")

    # Pre-flight safety checks — must all pass before any writes
    for osi in entry.items:
        batch = db.query(StockBatch).filter(StockBatch.BatchId == osi.BatchId).first()
        if not batch:
            raise HTTPException(
                409,
                f"Batch ID {osi.BatchId} ('{osi.BatchCode}') not found. Cannot void safely.",
            )

        med_name = osi.medicine.BrandName if osi.medicine else f"Medicine #{osi.MedicineId}"

        # Check 1: No sales from this batch
        sale_count = db.query(SaleItem).filter(SaleItem.BatchId == osi.BatchId).count()
        if sale_count > 0:
            raise HTTPException(
                409,
                f"Cannot void: {sale_count} sale(s) recorded from batch '{osi.BatchCode}' "
                f"({med_name}). Use Stock Adjustment to correct the remaining {batch.Quantity} units.",
            )

        # Check 2: No additional adjustments beyond the single creation row
        adj_count = (
            db.query(StockAdjustment)
            .filter(StockAdjustment.BatchId == osi.BatchId)
            .count()
        )
        if adj_count != 1:
            raise HTTPException(
                409,
                f"Cannot void: batch '{osi.BatchCode}' ({med_name}) has {adj_count} stock "
                f"adjustment(s) beyond the creation record. Use Stock Adjustment instead.",
            )

        # Check 3: Quantity unchanged from original
        if batch.Quantity != osi.Quantity:
            raise HTTPException(
                409,
                f"Cannot void: batch '{osi.BatchCode}' ({med_name}) has current quantity "
                f"{batch.Quantity} but original opening stock was {osi.Quantity}. "
                "Use Stock Adjustment to correct.",
            )

    # All checks passed — perform atomic void
    try:
        for osi in entry.items:
            batch = db.query(StockBatch).filter(StockBatch.BatchId == osi.BatchId).first()
            original_qty = batch.Quantity
            batch.Quantity = 0

            # Create Decrease adjustment for audit trail
            # Reason prefix "VOID_OPENING_STOCK:" is recognized by get_stock_movements()
            db.add(
                StockAdjustment(
                    BatchId=batch.BatchId,
                    UserId=current_user.UserId,
                    AdjustmentType="Decrease",
                    Quantity=original_qty,
                    PreviousQuantity=original_qty,
                    NewQuantity=0,
                    Reason=f"VOID_OPENING_STOCK:{entry.ReferenceNo}",
                )
            )

        entry.Status = "VOIDED"
        entry.VoidedAt = datetime.utcnow()
        entry.VoidedBy = current_user.UserId

        db.add(
            AuditLog(
                UserId=current_user.UserId,
                Action="OPENING_STOCK_VOID",
                Description=(
                    f"Opening Stock session {entry.ReferenceNo} voided. "
                    f"{entry.TotalItems} batch(es) zeroed. "
                    "To add stock, use Stock Adjustment."
                ),
            )
        )

        db.commit()

        return {
            "success": True,
            "message": (
                f"Session '{entry.ReferenceNo}' voided successfully. "
                "All batch quantities set to zero. "
                "To add stock to these batches, use Stock Adjustment."
            ),
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Integrity error during void. Please refresh and retry.")
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(500, str(exc))
