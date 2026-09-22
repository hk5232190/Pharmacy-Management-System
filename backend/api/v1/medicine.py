from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List
import random
import csv
import io
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import openpyxl
from pydantic import ValidationError
from decimal import Decimal, ROUND_HALF_UP

from models import Medicine, Category, Company, StockBatch, SaleItem, PurchaseItem, InventorySettings
from schemas.medicine import MedicineCreate, MedicineUpdate, MedicineResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

router = APIRouter(dependencies=[Depends(get_current_user)])

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
    from sqlalchemy.orm import joinedload
    medicines = db.query(Medicine).options(joinedload(Medicine.category), joinedload(Medicine.company)).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Brand Name", "Formula", "Category", "Company", 
        "Unit", "Dosage Form", "Reorder Level (Min Stock)", 
        "Rack Number", "Status"
    ])
    
    for med in medicines:
        cat_name = med.category.CategoryName if med.category else ""
        comp_name = med.company.CompanyName if med.company else ""
        status = "Active" if getattr(med, "IsActive", True) else "Inactive"
        
        writer.writerow([
            med.BrandName or "", 
            med.GenericName or "", 
            cat_name, 
            comp_name,
            med.Unit or "", 
            med.DosageForm or "", 
            med.ReorderLevel, 
            med.RackNumber or "",
            status
        ])
        
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medicines_export.csv"}
    )

@router.get("/import-template", summary="Download smart Excel template for import")
def download_import_template(db: Session = Depends(get_db)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Medicines"

    headers = [
        "Brand Name*", "Formula*", "Category*", "Company*", 
        "Unit*", "Dosage Form*", "Reorder Level (Min Stock)", "Rack Number", "Status*"
    ]
    
    for col_num, header in enumerate(headers, 1):
        ws.cell(row=1, column=col_num, value=header)
        ws.column_dimensions[get_column_letter(col_num)].width = 20
        
    categories = db.query(Category).all()
    companies = db.query(Company).all()
    
    cat_names = [c.CategoryName.replace(",", "") for c in categories if c.CategoryName]
    comp_names = [c.CompanyName.replace(",", "") for c in companies if c.CompanyName]
    
    if cat_names:
        # Excel data validation formula1 limit is 255 chars. 
        # If it's too long, we might need a hidden sheet, but for simplicity we'll try direct list
        cat_formula = '"' + ",".join(cat_names)[:253] + '"'
        dv_cat = DataValidation(type="list", formula1=cat_formula, allow_blank=True)
        ws.add_data_validation(dv_cat)
        dv_cat.add('C2:C1000')
        
    if comp_names:
        comp_formula = '"' + ",".join(comp_names)[:253] + '"'
        dv_comp = DataValidation(type="list", formula1=comp_formula, allow_blank=True)
        ws.add_data_validation(dv_comp)
        dv_comp.add('D2:D1000')
        
    # Unit dropdown
    dv_unit = DataValidation(type="list", formula1='"Box,Strip,Bottle,Tube,Piece,Vial,Ampoule,Sachet,Pack,Jar,Can"', allow_blank=True)
    ws.add_data_validation(dv_unit)
    dv_unit.add('E2:E1000')
    
    # Dosage dropdown
    dosage_formula = '"Tablet,Capsule,Syrup,Suspension,Injection,Cream,Ointment,Drops,Gel,Lotion,Spray,Inhaler,Powder,Suppository,Other"'
    dv_dosage = DataValidation(type="list", formula1=dosage_formula, allow_blank=True)
    ws.add_data_validation(dv_dosage)
    dv_dosage.add('F2:F1000')

    # Status dropdown
    dv_status = DataValidation(type="list", formula1='"Active,Inactive"', allow_blank=True)
    ws.add_data_validation(dv_status)
    dv_status.add('I2:I1000')

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=medicines_import_template.xlsx"}
    )

@router.post("/import-preview", summary="Preview medicines import and map categories/companies")
def preview_medicines_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are allowed")
        
    contents = file.file.read()
    rows = []
    
    if file.filename.endswith('.csv'):
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        rows = list(csv_reader)
    else:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        sheet = wb.active
        sheet_rows = list(sheet.iter_rows(values_only=True))
        if sheet_rows:
            headers = [str(cell).strip() if cell is not None else "" for cell in sheet_rows[0]]
            # normalize headers
            headers = [h.replace("*", "").replace("(0/1)", "").strip() for h in headers]
            for row in sheet_rows[1:]:
                if any(cell is not None and str(cell).strip() for cell in row):
                    row_dict = {headers[i]: str(cell).strip() if cell is not None else "" for i, cell in enumerate(row) if i < len(headers)}
                    rows.append(row_dict)
                    
    # Pre-fetch for quick mapping
    categories = {c.CategoryName.lower(): c.CategoryId for c in db.query(Category).all() if c.CategoryName}
    companies = {c.CompanyName.lower(): c.CompanyId for c in db.query(Company).all() if c.CompanyName}
    
    preview_data = []
    for i, row in enumerate(rows, start=1):
        row_preview = {
            "RowNumber": i,
            "BrandName": row.get("Brand Name", row.get("BrandName", "")),
            "GenericName": row.get("Formula", row.get("GenericName", "")),
            "CategoryName": row.get("Category", row.get("CategoryName", "")),
            "CompanyName": row.get("Company", row.get("CompanyName", "")),
            "Unit": row.get("Unit", "Box"),
            "DosageForm": row.get("Dosage Form", row.get("DosageForm", "")),
            "Strength": "",
            "ReorderLevel": row.get("Reorder Level (Min Stock)", row.get("ReorderLevel", 10)),
            "RackNumber": row.get("Rack Number", row.get("RackNumber", "")),
            "DefaultCostPrice": 0.0,
            "DefaultSellingPrice": 0.0,
            "Barcode": None,
            "RequiresPrescription": False,
            "IsActive": row.get("Status", row.get("IsActive", "Active")).strip().lower() == "active",
            
            "CategoryId": None,
            "CompanyId": None,
            "IsValid": True,
            "Errors": []
        }
        
        if not row_preview["BrandName"]:
            row_preview["IsValid"] = False
            row_preview["Errors"].append("Brand Name is required")
        if not row_preview["GenericName"]:
            row_preview["IsValid"] = False
            row_preview["Errors"].append("Formula is required")
            
        cat_name = row_preview["CategoryName"].lower() if row_preview["CategoryName"] else ""
        comp_name = row_preview["CompanyName"].lower() if row_preview["CompanyName"] else ""
        
        if cat_name in categories:
            row_preview["CategoryId"] = categories[cat_name]
        else:
            row_preview["IsValid"] = False
            row_preview["Errors"].append(f"Category '{row_preview['CategoryName']}' not found in DB")
            
        if comp_name in companies:
            row_preview["CompanyId"] = companies[comp_name]
        else:
            row_preview["IsValid"] = False
            row_preview["Errors"].append(f"Company '{row_preview['CompanyName']}' not found in DB")
            
        try:
            row_preview["ReorderLevel"] = int(float(row_preview["ReorderLevel"]) if str(row_preview["ReorderLevel"]).strip() else 10)
        except ValueError:
            row_preview["ReorderLevel"] = 10

        preview_data.append(row_preview)
        
    return {"success": True, "data": preview_data, "message": "Preview generated"}

@router.post("/import-bulk", summary="Bulk create validated medicines")
def bulk_import_medicines(
    medicines: List[MedicineCreate],
    db: Session = Depends(get_db)
):
    count = 0
    for med_in in medicines:
        dump = med_in.model_dump()
        if dump.get("Barcode") == "":
            dump["Barcode"] = None
        new_med = Medicine(**dump)
        db.add(new_med)
        count += 1
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error during import: {str(e)}")
        
    return {"success": True, "message": f"Successfully imported {count} medicines"}

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
