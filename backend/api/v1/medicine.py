from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List
import random
import csv
import io
from decimal import Decimal, ROUND_HALF_UP

from models import Medicine, Category, Company, StockBatch, SaleItem, PurchaseItem, InventorySettings
from schemas.medicine import MedicineCreate, MedicineUpdate, MedicineResponse
from schemas.base import BaseResponse
from api.deps import get_current_admin_user, get_current_user, get_db
from core.logger import logger

router = APIRouter(dependencies=[Depends(get_current_admin_user)])

@router.get("", summary="Get all medicines")
def get_medicines(
    search: str = Query(None, description="Search by name, generic name, or barcode"),
    category_id: int = Query(None, description="Filter by CategoryId"),
    company_id: int = Query(None, description="Filter by CompanyId"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=0, description="Items per page. 0 for all."),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Medicine, Category.CategoryName, Company.CompanyName)\
              .outerjoin(Category, Medicine.CategoryId == Category.CategoryId)\
              .outerjoin(Company, Medicine.CompanyId == Company.CompanyId)
    
    if search:
        search_term = search.strip()
        search_id = None
        if search_term.upper().startswith("MED-"):
            id_part = search_term[4:].lstrip("0")
            if id_part.isdigit():
                search_id = int(id_part)
        elif search_term.isdigit():
            search_id = int(search_term)
            
        conditions = [
            Medicine.BrandName.ilike(f"%{search_term}%"),
            Medicine.GenericName.ilike(f"%{search_term}%"),
            Medicine.Barcode.ilike(f"%{search_term}%")
        ]
        if search_id is not None:
            conditions.append(Medicine.MedicineId == search_id)
            
        query = query.filter(or_(*conditions))
    if category_id:
        query = query.filter(Medicine.CategoryId == category_id)
    if company_id:
        query = query.filter(Medicine.CompanyId == company_id)
        
    total = query.count()
    
    if page_size > 0:
        query = query.order_by(Medicine.BrandName).offset((page - 1) * page_size).limit(page_size)
    else:
        query = query.order_by(Medicine.BrandName)
        
    results = query.all()
    
    medicines_list = []
    for med, cat_name, comp_name in results:
        med_dict = {c.name: getattr(med, c.name) for c in med.__table__.columns}
        med_dict["CategoryName"] = cat_name
        med_dict["CompanyName"] = comp_name
        medicines_list.append(med_dict)
        
    return {"success": True, "data": medicines_list, "total": total, "page": page, "page_size": page_size}

@router.post("", response_model=BaseResponse[MedicineResponse], summary="Create a new medicine")
def create_medicine(
    medicine_in: MedicineCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Fetch Inventory Settings for Auto-Barcode preference
    inv_settings = db.query(InventorySettings).first()
    auto_generate = inv_settings.AutoGenerateBarcode if inv_settings else True

    # Auto-generate EAN-13 barcode if none provided and setting is enabled
    if not medicine_in.Barcode and auto_generate:
        while True:
            # Generate 12 random digits for EAN-13
            base = str(random.randint(100000000000, 999999999999))
            
            # Calculate EAN-13 check digit
            total = 0
            for i, char in enumerate(base):
                if i % 2 == 0:
                    total += int(char) * 1
                else:
                    total += int(char) * 3
            check_digit = (10 - (total % 10)) % 10
            
            generated_barcode = base + str(check_digit)
            
            # Uniqueness check
            existing = db.query(Medicine).filter(Medicine.Barcode == generated_barcode).first()
            if not existing:
                medicine_in.Barcode = generated_barcode
                break

    # Optional: check if barcode already exists
    if medicine_in.Barcode:
        existing = db.query(Medicine).filter(Medicine.Barcode == medicine_in.Barcode).first()
        if existing:
            raise HTTPException(status_code=400, detail="Medicine with this barcode already exists")
            
    # Apply defaults from Inventory Settings
    if not medicine_in.Unit:
        medicine_in.Unit = inv_settings.DefaultUnit if inv_settings else "Box"
    
    if medicine_in.ReorderLevel is None or medicine_in.ReorderLevel == 0:
        medicine_in.ReorderLevel = inv_settings.LowStockThreshold if inv_settings else 10
        
    # Calculate precision selling price if not provided
    if medicine_in.DefaultCostPrice and (not medicine_in.DefaultSellingPrice or medicine_in.DefaultSellingPrice == 0):
        margin = Decimal(str(inv_settings.DefaultProfitMargin)) if inv_settings else Decimal('0')
        cost = Decimal(str(medicine_in.DefaultCostPrice))
        selling = cost * (Decimal('1') + margin / Decimal('100'))
        medicine_in.DefaultSellingPrice = float(selling.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
            
    new_medicine = Medicine(**medicine_in.model_dump())
    db.add(new_medicine)
    db.commit()
    db.refresh(new_medicine)
    
    # Load relationships for response
    med = db.query(Medicine).filter(Medicine.MedicineId == new_medicine.MedicineId).first()
    response_data = {c.name: getattr(med, c.name) for c in med.__table__.columns}
    response_data["CategoryName"] = med.category.CategoryName if med.category else None
    response_data["CompanyName"] = med.company.CompanyName if med.company else None
    
    return {"data": response_data, "message": "Medicine created successfully"}

@router.get("/export", summary="Export all medicines to CSV")
def export_medicines(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    medicines = db.query(Medicine).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "BrandName", "GenericName", "CategoryId", "CompanyId", 
        "RackNumber", "ReorderLevel", "RequiresPrescription", 
        "Unit", "DosageForm", "Strength", "Barcode", "DefaultCostPrice", "DefaultSellingPrice"
    ])
    
    for med in medicines:
        writer.writerow([
            med.BrandName, med.GenericName, med.CategoryId, med.CompanyId,
            med.RackNumber or "", med.ReorderLevel, int(med.RequiresPrescription),
            med.Unit, med.DosageForm or "", med.Strength or "", med.Barcode or "", med.DefaultCostPrice, med.DefaultSellingPrice
        ])
        
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medicines_export.csv"}
    )

@router.post("/import", summary="Import medicines from CSV")
def import_medicines(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    content = file.file.read().decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(content))
    
    imported_count = 0
    for row in csv_reader:
        try:
            # Basic validation
            if not row.get("BrandName") or not row.get("GenericName"):
                continue
                
            # Create Medicine
            new_med = Medicine(
                BrandName=row["BrandName"],
                GenericName=row["GenericName"],
                CategoryId=int(row["CategoryId"]),
                CompanyId=int(row["CompanyId"]),
                RackNumber=row.get("RackNumber") or None,
                ReorderLevel=int(row.get("ReorderLevel", 10)),
                RequiresPrescription=bool(int(row.get("RequiresPrescription", 0))),
                Unit=row.get("Unit", "Box"),
                DosageForm=row.get("DosageForm") or None,
                Strength=row.get("Strength") or None,
                Barcode=row.get("Barcode") or None,
                DefaultCostPrice=float(row.get("DefaultCostPrice", 0)),
                DefaultSellingPrice=float(row.get("DefaultSellingPrice", 0))
            )
            db.add(new_med)
            imported_count += 1
        except Exception as e:
            # Skip invalid rows
            continue
            
    db.commit()
    return {"message": f"Successfully imported {imported_count} medicines", "success": True}

@router.put("/{medicine_id}", response_model=BaseResponse[MedicineResponse], summary="Update a medicine")
def update_medicine(
    medicine_id: int,
    medicine_in: MedicineUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    medicine = db.query(Medicine).filter(Medicine.MedicineId == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
        
    if medicine_in.Barcode and medicine_in.Barcode != medicine.Barcode:
        existing = db.query(Medicine).filter(Medicine.Barcode == medicine_in.Barcode).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another medicine with this barcode already exists")
            
    update_data = medicine_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(medicine, field, value)
        
    db.commit()
    db.refresh(medicine)
    
    response_data = {c.name: getattr(medicine, c.name) for c in medicine.__table__.columns}
    response_data["CategoryName"] = medicine.category.CategoryName if medicine.category else None
    response_data["CompanyName"] = medicine.company.CompanyName if medicine.company else None
    
    return {"data": response_data, "message": "Medicine updated successfully"}

@router.put("/{medicine_id}/status", response_model=BaseResponse[MedicineResponse], summary="Toggle medicine status")
def toggle_medicine_status(
    medicine_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    medicine = db.query(Medicine).filter(Medicine.MedicineId == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
        
    medicine.IsActive = not medicine.IsActive
    db.commit()
    db.refresh(medicine)
    return {"data": medicine, "message": f"Medicine status changed to {'Active' if medicine.IsActive else 'Inactive'}"}

@router.delete("/{medicine_id}", summary="Delete a medicine")
def delete_medicine(
    medicine_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    medicine = db.query(Medicine).filter(Medicine.MedicineId == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
        
    # Comprehensive Dependency Check
    has_batches = db.query(StockBatch).filter(StockBatch.MedicineId == medicine_id).count() > 0
    has_sales = db.query(SaleItem).filter(SaleItem.BatchId.in_(
        db.query(StockBatch.BatchId).filter(StockBatch.MedicineId == medicine_id)
    )).count() > 0
    has_purchases = db.query(PurchaseItem).filter(PurchaseItem.MedicineId == medicine_id).count() > 0
    
    if has_batches or has_sales or has_purchases:
        logger.warning(f"AUDIT: User {current_user.Username} attempted to delete medicine {medicine_id} ({medicine.BrandName}) but was blocked. Reason: Dependency records exist (Batches: {has_batches}, Sales: {has_sales}, Purchases: {has_purchases}).")
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete medicine because sales, purchases, or stock batch records exist. Please set its status to Inactive instead."
        )
        
    try:
        med_name = medicine.BrandName
        db.delete(medicine)
        db.commit()
        logger.info(f"AUDIT: User {current_user.Username} successfully deleted medicine {medicine_id} ({med_name}).")
        return {"success": True, "message": "Medicine deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} encountered IntegrityError deleting medicine {medicine_id}. Error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this medicine due to database constraints."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to delete medicine {medicine_id}. Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the medicine")
