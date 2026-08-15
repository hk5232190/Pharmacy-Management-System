from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List
import random
import csv
import io

from models import Medicine, Category, Company, StockBatch, SaleItem, PurchaseItem
from schemas.medicine import MedicineCreate, MedicineUpdate, MedicineResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

router = APIRouter()

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
    # Auto-generate barcode if none provided
    if not medicine_in.Barcode:
        while True:
            generated_barcode = str(random.randint(1000000000000, 9999999999999))
            existing = db.query(Medicine).filter(Medicine.Barcode == generated_barcode).first()
            if not existing:
                medicine_in.Barcode = generated_barcode
                break

    # Optional: check if barcode already exists
    if medicine_in.Barcode:
        existing = db.query(Medicine).filter(Medicine.Barcode == medicine_in.Barcode).first()
        if existing:
            raise HTTPException(status_code=400, detail="Medicine with this barcode already exists")
            
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


@router.get("/export", summary="Export all medicines to CSV")
def export_medicines(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        medicines = db.query(Medicine).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "BrandName", "GenericName", "CategoryName", "CompanyName", 
            "RackNumber", "ReorderLevel", "RequiresPrescription", 
            "Unit", "Barcode", "DefaultCostPrice", "DefaultSellingPrice", "IsActive"
        ])
        
        # Write rows
        for med in medicines:
            cat_name = med.category.Name if med.category else ""
            comp_name = med.company.Name if med.company else ""
            writer.writerow([
                med.BrandName, med.GenericName, cat_name, comp_name,
                med.RackNumber, med.ReorderLevel, med.RequiresPrescription,
                med.Unit, med.Barcode, med.DefaultCostPrice, med.DefaultSellingPrice, med.IsActive
            ])
            
        logger.info(f"AUDIT: User {current_user.Username} exported {len(medicines)} medicines to CSV.")
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=medicines_export.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting medicines: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export medicines")

@router.post("/import", summary="Import medicines from CSV")
def import_medicines(
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
                brand = row.get("BrandName", "").strip()
                generic = row.get("GenericName", "").strip()
                cat_name = row.get("CategoryName", "").strip()
                comp_name = row.get("CompanyName", "").strip()
                unit = row.get("Unit", "Box").strip()
                
                if not brand or not generic or not cat_name or not comp_name:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: BrandName, GenericName, CategoryName, and CompanyName are required")
                    continue
                
                # Resolve Category
                category = db.query(Category).filter(Category.Name.ilike(cat_name)).first()
                if not category:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: Category '{cat_name}' not found")
                    continue
                    
                # Resolve Company
                company = db.query(Company).filter(Company.Name.ilike(comp_name)).first()
                if not company:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: Company '{comp_name}' not found")
                    continue
                
                is_active_str = row.get("IsActive", "True").strip().lower()
                is_active = is_active_str in ('true', '1', 'yes')
                
                req_presc_str = row.get("RequiresPrescription", "False").strip().lower()
                req_presc = req_presc_str in ('true', '1', 'yes')
                
                # Check uniqueness by brand name
                existing = db.query(Medicine).filter(Medicine.BrandName.ilike(brand)).first()
                if existing:
                    skipped_count += 1
                    continue
                    
                new_med = Medicine(
                    BrandName=brand,
                    GenericName=generic,
                    CategoryId=category.CategoryId,
                    CompanyId=company.CompanyId,
                    RackNumber=row.get("RackNumber", "").strip() or None,
                    ReorderLevel=int(row.get("ReorderLevel", "10").strip() or 10),
                    RequiresPrescription=req_presc,
                    Unit=unit,
                    Barcode=row.get("Barcode", "").strip() or f"MED{random.randint(10000, 99999)}",
                    DefaultCostPrice=float(row.get("DefaultCostPrice", "0").strip() or 0),
                    DefaultSellingPrice=float(row.get("DefaultSellingPrice", "0").strip() or 0),
                    IsActive=is_active
                )
                db.add(new_med)
                imported_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {row_idx}: {str(e)}")
        
        if imported_count > 0:
            db.commit()
            
        logger.info(f"AUDIT: User {current_user.Username} imported {imported_count} medicines. Skipped: {skipped_count}. Errors: {len(errors)}")
        
        return {
            "data": {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors
            },
            "message": f"Successfully imported {imported_count} medicines. Skipped: {skipped_count}."
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to import medicines. Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import medicines: {str(e)}")


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
