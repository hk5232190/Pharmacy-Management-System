from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from models import Customer
from schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

router = APIRouter()

@router.get("", response_model=BaseResponse[List[CustomerResponse]], summary="Get all customers")
def get_customers(
    search: str = Query(None, description="Search by customer name or phone"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Customer)
    
    if search:
        query = query.filter(
            or_(
                Customer.Name.ilike(f"%{search}%"),
                Customer.Phone.ilike(f"%{search}%")
            )
        )
        
    customers = query.order_by(Customer.Name).all()
    return {"data": customers}

@router.post("", response_model=BaseResponse[CustomerResponse], summary="Create a new customer")
def create_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Depending on requirements, phone might be unique, but let's just create it
    new_customer = Customer(
        Name=customer_in.Name,
        Phone=customer_in.Phone,
        LoyaltyPoints=customer_in.LoyaltyPoints,
        IsActive=customer_in.IsActive
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return {"data": new_customer, "message": "Customer created successfully"}

@router.put("/{customer_id}", response_model=BaseResponse[CustomerResponse], summary="Update a customer")
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    if customer_in.Name is not None:
        customer.Name = customer_in.Name
    if customer_in.Phone is not None:
        customer.Phone = customer_in.Phone
    if customer_in.LoyaltyPoints is not None:
        customer.LoyaltyPoints = customer_in.LoyaltyPoints
    if customer_in.IsActive is not None:
        customer.IsActive = customer_in.IsActive
        
    db.commit()
    db.refresh(customer)
    return {"data": customer, "message": "Customer updated successfully"}

@router.put("/{customer_id}/status", response_model=BaseResponse[CustomerResponse], summary="Toggle customer status")
def toggle_customer_status(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    customer.IsActive = not customer.IsActive
    db.commit()
    db.refresh(customer)
    return {"data": customer, "message": f"Customer status changed to {'Active' if customer.IsActive else 'Inactive'}"}
