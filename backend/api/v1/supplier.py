from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from models import Supplier
from schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.get("", response_model=BaseResponse[List[SupplierResponse]], summary="Get all suppliers")
def get_suppliers(
    search: str = Query(None, description="Search by supplier name, phone, or tax number"),
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
        
    suppliers = query.order_by(Supplier.Name).all()
    return {"data": suppliers}

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
