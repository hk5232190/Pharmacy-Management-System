from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List
import csv
import io

from models import Supplier, Purchase
from schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

router = APIRouter()

@router.get("", summary="Get all suppliers")
def get_suppliers(
    search: str = Query(None, description="Search by supplier name, phone, or tax number"),
    status: str = Query(None, description="Filter by status (active/inactive)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=0, description="Items per page. 0 for all."),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Supplier)
    
    if search:
        query = query.filter(
            or_(
                Supplier.Name.ilike(f"%{search}%"),
                Supplier.Phone.ilike(f"%{search}%"),
                Supplier.TaxNumber.ilike(f"%{search}%")
            )
        )
        
    if status and status.lower() != 'all':
        is_active = status.lower() == 'active'
        query = query.filter(Supplier.IsActive == is_active)
        
    total = query.count()
    
    if page_size > 0:
        query = query.order_by(Supplier.Name).offset((page - 1) * page_size).limit(page_size)
    else:
        query = query.order_by(Supplier.Name)
        
    suppliers = query.all()
    
    return {"success": True, "data": suppliers, "total": total, "page": page, "page_size": page_size}

@router.post("", response_model=BaseResponse[SupplierResponse], summary="Create a new supplier")
def create_supplier(
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    existing = db.query(Supplier).filter(Supplier.Name.ilike(supplier_in.Name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")
        
    new_supplier = Supplier(
        Name=supplier_in.Name,
        Phone=supplier_in.Phone,
        TaxNumber=supplier_in.TaxNumber,
        Address=supplier_in.Address,
        ContactPerson=supplier_in.ContactPerson,
        CurrentBalance=supplier_in.CurrentBalance,
        IsActive=supplier_in.IsActive
    )
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return {"data": new_supplier, "message": "Supplier created successfully"}

@router.put("/{supplier_id}", response_model=BaseResponse[SupplierResponse], summary="Update a supplier")
def update_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.SupplierId == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    if supplier_in.Name is not None:
        existing = db.query(Supplier).filter(
            Supplier.Name.ilike(supplier_in.Name),
            Supplier.SupplierId != supplier_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another supplier with this name already exists")
        supplier.Name = supplier_in.Name
        
    if supplier_in.Phone is not None:
        supplier.Phone = supplier_in.Phone
    if supplier_in.TaxNumber is not None:
        supplier.TaxNumber = supplier_in.TaxNumber
    if supplier_in.Address is not None:
        supplier.Address = supplier_in.Address
    if supplier_in.ContactPerson is not None:
        supplier.ContactPerson = supplier_in.ContactPerson
    if supplier_in.CurrentBalance is not None:
        supplier.CurrentBalance = supplier_in.CurrentBalance
    if supplier_in.IsActive is not None:
        supplier.IsActive = supplier_in.IsActive
        
    db.commit()
    db.refresh(supplier)
    return {"data": supplier, "message": "Supplier updated successfully"}

@router.put("/{supplier_id}/status", response_model=BaseResponse[SupplierResponse], summary="Toggle supplier status")
def toggle_supplier_status(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.SupplierId == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    supplier.IsActive = not supplier.IsActive
    db.commit()
    db.refresh(supplier)
    return {"data": supplier, "message": f"Supplier status changed to {'Active' if supplier.IsActive else 'Inactive'}"}

@router.get("/export", summary="Export all suppliers to CSV")
def export_suppliers(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        suppliers = db.query(Supplier).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Name", "Phone", "TaxNumber", "Address", "IsActive"])
        
        # Write rows
        for sup in suppliers:
            writer.writerow([sup.Name, sup.Phone, sup.TaxNumber, sup.Address, sup.IsActive])
            
        logger.info(f"AUDIT: User {current_user.Username} exported {len(suppliers)} suppliers to CSV.")
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=suppliers_export.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting suppliers: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export suppliers")

@router.post("/import", summary="Import suppliers from CSV")
def import_suppliers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    try:
        contents = file.file.read().decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(contents))
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for row_idx, row in enumerate(csv_reader, start=2): # Row 1 is header
            try:
                name = row.get("Name", "").strip()
                phone = row.get("Phone", "").strip()
                tax = row.get("TaxNumber", "").strip()
                address = row.get("Address", "").strip()
                
                if not name or not phone:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: Name and Phone are required")
                    continue
                    
                is_active_str = row.get("IsActive", "True").strip().lower()
                is_active = is_active_str in ('true', '1', 'yes')
                
                # Check uniqueness by name
                existing = db.query(Supplier).filter(Supplier.Name.ilike(name)).first()
                if existing:
                    skipped_count += 1
                    continue
                    
                new_supplier = Supplier(
                    Name=name,
                    Phone=phone,
                    TaxNumber=tax if tax else None,
                    Address=address if address else None,
                    IsActive=is_active
                )
                db.add(new_supplier)
                imported_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {row_idx}: {str(e)}")
        
        if imported_count > 0:
            db.commit()
            
        logger.info(f"AUDIT: User {current_user.Username} imported {imported_count} suppliers. Skipped: {skipped_count}. Errors: {len(errors)}")
        
        return {
            "data": {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors
            },
            "message": f"Successfully imported {imported_count} suppliers. Skipped: {skipped_count}."
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to import suppliers. Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import suppliers: {str(e)}")


@router.delete("/{supplier_id}", summary="Delete a supplier")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.SupplierId == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Foreign Key Verification Check
    linked_purchases_count = db.query(Purchase).filter(Purchase.SupplierId == supplier_id).count()
    if linked_purchases_count > 0:
        logger.warning(f"AUDIT: User {current_user.Username} attempted to delete supplier {supplier_id} ({supplier.Name}) but was blocked. Reason: {linked_purchases_count} purchase orders exist.")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete supplier because {linked_purchases_count} purchase orders are linked to it."
        )
        
    try:
        supplier_name = supplier.Name
        db.delete(supplier)
        db.commit()
        logger.info(f"AUDIT: User {current_user.Username} successfully deleted supplier {supplier_id} ({supplier_name}).")
        return {"success": True, "message": "Supplier deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} encountered IntegrityError deleting supplier {supplier_id}. Error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this supplier due to database constraints."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to delete supplier {supplier_id}. Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the supplier")
