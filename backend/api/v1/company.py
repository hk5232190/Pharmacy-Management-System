from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from models import Company
from schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.get("", response_model=BaseResponse[List[CompanyResponse]], summary="Get all companies")
def get_companies(
    search: str = Query(None, description="Search by company name"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Company)
    
    if search:
        query = query.filter(Company.CompanyName.ilike(f"%{search}%"))
        
    companies = query.order_by(Company.CompanyName).all()
    return {"data": companies}

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
