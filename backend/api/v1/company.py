from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func
from typing import List
import csv
import io

from models import Company, Medicine
from schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

router = APIRouter()

@router.get("", summary="Get all companies")
def get_companies(
    search: str = Query(None, description="Search by company name"),
    status: str = Query(None, description="Filter by status (active/inactive)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=0, description="Items per page. 0 for all."),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Company, func.count(Medicine.MedicineId).label('TotalProducts'))\
              .outerjoin(Medicine, Company.CompanyId == Medicine.CompanyId)\
              .group_by(Company.CompanyId)
    
    if search:
        query = query.filter(
            or_(
                Company.CompanyName.ilike(f"%{search}%"),
                Company.Phone.ilike(f"%{search}%")
            )
        )
        
    if status and status.lower() != 'all':
        is_active = status.lower() == 'active'
        query = query.filter(Company.IsActive == is_active)
        
    total = query.count()
    
    if page_size > 0:
        query = query.order_by(Company.CompanyName).offset((page - 1) * page_size).limit(page_size)
    else:
        query = query.order_by(Company.CompanyName)
        
    results = query.all()
    
    companies_list = []
    for comp, med_count in results:
        comp_dict = {c.name: getattr(comp, c.name) for c in comp.__table__.columns}
        comp_dict["TotalProducts"] = med_count
        companies_list.append(comp_dict)
        
    return {"success": True, "data": companies_list, "total": total, "page": page, "page_size": page_size}

@router.post("", response_model=BaseResponse[CompanyResponse], summary="Create a new company")
def create_company(
    company_in: CompanyCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    existing = db.query(Company).filter(Company.CompanyName.ilike(company_in.CompanyName)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company with this name already exists")
        
    new_company = Company(
        CompanyName=company_in.CompanyName,
        ContactPerson=company_in.ContactPerson,
        Phone=company_in.Phone,
        Address=company_in.Address,
        IsActive=company_in.IsActive
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return {"data": new_company, "message": "Company created successfully"}

@router.put("/{company_id}", response_model=BaseResponse[CompanyResponse], summary="Update a company")
def update_company(
    company_id: int,
    company_in: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.CompanyId == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    if company_in.CompanyName is not None:
        existing = db.query(Company).filter(
            Company.CompanyName.ilike(company_in.CompanyName),
            Company.CompanyId != company_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another company with this name already exists")
        company.CompanyName = company_in.CompanyName
        
    if company_in.ContactPerson is not None:
        company.ContactPerson = company_in.ContactPerson
        
    if company_in.Phone is not None:
        company.Phone = company_in.Phone
        
    if company_in.Address is not None:
        company.Address = company_in.Address
        
    if company_in.IsActive is not None:
        company.IsActive = company_in.IsActive
        
    db.commit()
    db.refresh(company)
    return {"data": company, "message": "Company updated successfully"}

@router.put("/{company_id}/status", response_model=BaseResponse[CompanyResponse], summary="Toggle company status")
def toggle_company_status(
    company_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.CompanyId == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.IsActive = not company.IsActive
    db.commit()
    db.refresh(company)
    return {"data": company, "message": f"Company status changed to {'Active' if company.IsActive else 'Inactive'}"}

@router.get("/export", summary="Export all companies to CSV")
def export_companies(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        companies = db.query(Company).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["CompanyName", "IsActive"])
        
        # Write rows
        for company in companies:
            writer.writerow([company.CompanyName, company.IsActive])
            
        logger.info(f"AUDIT: User {current_user.Username} exported {len(companies)} companies to CSV.")
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=companies_export.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting companies: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export companies")

@router.post("/import", summary="Import companies from CSV")
def import_companies(
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
                company_name = row.get("CompanyName", "").strip()
                if not company_name:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: CompanyName is required")
                    continue
                    
                is_active_str = row.get("IsActive", "True").strip().lower()
                is_active = is_active_str in ('true', '1', 'yes')
                
                # Check uniqueness
                existing = db.query(Company).filter(Company.CompanyName.ilike(company_name)).first()
                if existing:
                    skipped_count += 1
                    continue
                    
                new_company = Company(
                    CompanyName=company_name,
                    IsActive=is_active
                )
                db.add(new_company)
                imported_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {row_idx}: {str(e)}")
        
        if imported_count > 0:
            db.commit()
            
        logger.info(f"AUDIT: User {current_user.Username} imported {imported_count} companies. Skipped: {skipped_count}. Errors: {len(errors)}")
        
        return {
            "data": {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors
            },
            "message": f"Successfully imported {imported_count} companies. Skipped: {skipped_count}."
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to import companies. Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import companies: {str(e)}")

@router.delete("/{company_id}", summary="Delete a company")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.CompanyId == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Foreign Key Verification Check
    linked_medicines_count = db.query(Medicine).filter(Medicine.CompanyId == company_id).count()
    if linked_medicines_count > 0:
        logger.warning(f"AUDIT: User {current_user.Username} attempted to delete company {company_id} ({company.CompanyName}) but was blocked. Reason: {linked_medicines_count} medicines assigned.")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete company because {linked_medicines_count} medicines are assigned to it."
        )
        
    try:
        company_name = company.CompanyName
        db.delete(company)
        db.commit()
        logger.info(f"AUDIT: User {current_user.Username} successfully deleted company {company_id} ({company_name}).")
        return {"success": True, "message": "Company deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} encountered IntegrityError deleting company {company_id}. Error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this company due to database constraints (it may be linked to other records)."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to delete company {company_id}. Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the company")
