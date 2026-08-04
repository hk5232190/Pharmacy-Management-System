from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
import random
import csv
import io

from models import Medicine, Category, Company
from schemas.medicine import MedicineCreate, MedicineUpdate, MedicineResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.get("", response_model=BaseResponse[List[MedicineResponse]], summary="Get all medicines")
def get_medicines(
    search: str = Query(None, description="Search by name, generic name, or barcode"),
    category_id: int = Query(None, description="Filter by CategoryId"),
    company_id: int = Query(None, description="Filter by CompanyId"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Medicine, Category.CategoryName, Company.CompanyName)\
              .outerjoin(Category, Medicine.CategoryId == Category.CategoryId)\
              .outerjoin(Company, Medicine.CompanyId == Company.CompanyId)
    
    if search:
        query = query.filter(
            or_(
                Medicine.BrandName.ilike(f"%{search}%"),
                Medicine.GenericName.ilike(f"%{search}%"),
                Medicine.Barcode.ilike(f"%{search}%")
            )
        )
    if category_id:
        query = query.filter(Medicine.CategoryId == category_id)
    if company_id:
        query = query.filter(Medicine.CompanyId == company_id)
        
    results = query.order_by(Medicine.BrandName).all()
    
    medicines_list = []
    for med, cat_name, comp_name in results:
        med_dict = {c.name: getattr(med, c.name) for c in med.__table__.columns}
        med_dict["CategoryName"] = cat_name
        med_dict["CompanyName"] = comp_name
        medicines_list.append(med_dict)
        
    return {"data": medicines_list}

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
        "Unit", "Barcode", "DefaultCostPrice", "DefaultSellingPrice"
    ])
    
    for med in medicines:
        writer.writerow([
            med.BrandName, med.GenericName, med.CategoryId, med.CompanyId,
            med.RackNumber or "", med.ReorderLevel, int(med.RequiresPrescription),
            med.Unit, med.Barcode or "", med.DefaultCostPrice, med.DefaultSellingPrice
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
    
    response_data = {c.name: getattr(medicine, c.name) for c in medicine.__table__.columns}
    response_data["CategoryName"] = medicine.category.CategoryName if medicine.category else None
    response_data["CompanyName"] = medicine.company.CompanyName if medicine.company else None
    
    return {"data": response_data, "message": f"Medicine status changed to {'Active' if medicine.IsActive else 'Inactive'}"}
