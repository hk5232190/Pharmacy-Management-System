from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List
import csv
import io

from models import Customer, Sale
from schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

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


@router.get("/export", summary="Export all customers to CSV")
def export_customers(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        customers = db.query(Customer).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Name", "Phone", "LoyaltyPoints", "IsActive"])
        
        # Write rows
        for cust in customers:
            writer.writerow([cust.Name, cust.Phone, cust.LoyaltyPoints, cust.IsActive])
            
        logger.info(f"AUDIT: User {current_user.Username} exported {len(customers)} customers to CSV.")
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=customers_export.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting customers: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export customers")

@router.post("/import", summary="Import customers from CSV")
def import_customers(
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
                points_str = row.get("LoyaltyPoints", "0").strip()
                
                if not name:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: Name is required")
                    continue
                    
                is_active_str = row.get("IsActive", "True").strip().lower()
                is_active = is_active_str in ('true', '1', 'yes')
                
                try:
                    points = int(points_str)
                except:
                    points = 0
                
                # Check uniqueness by name
                existing = db.query(Customer).filter(Customer.Name.ilike(name)).first()
                if existing:
                    skipped_count += 1
                    continue
                    
                new_customer = Customer(
                    Name=name,
                    Phone=phone if phone else None,
                    LoyaltyPoints=points,
                    IsActive=is_active
                )
                db.add(new_customer)
                imported_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {row_idx}: {str(e)}")
        
        if imported_count > 0:
            db.commit()
            
        logger.info(f"AUDIT: User {current_user.Username} imported {imported_count} customers. Skipped: {skipped_count}. Errors: {len(errors)}")
        
        return {
            "data": {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors
            },
            "message": f"Successfully imported {imported_count} customers. Skipped: {skipped_count}."
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to import customers. Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import customers: {str(e)}")


@router.delete("/{customer_id}", summary="Delete a customer")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    # Outstanding Dues & Sales History Verification Check
    customer_sales = db.query(Sale).filter(Sale.CustomerId == customer_id).all()
    
    if customer_sales:
        # Calculate total outstanding balance
        outstanding_balance = sum(float(sale.GrandTotal - sale.PaidAmount) for sale in customer_sales)
        
        if outstanding_balance > 0:
            logger.warning(f"AUDIT: User {current_user.Username} attempted to delete customer {customer_id} ({customer.Name}) but was blocked. Reason: Outstanding credit balance of Rs. {outstanding_balance:.2f}.")
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete customer: Outstanding credit balance of Rs. {outstanding_balance:.2f} must be settled first."
            )
        else:
            logger.warning(f"AUDIT: User {current_user.Username} attempted to delete customer {customer_id} ({customer.Name}) but was blocked. Reason: Sales invoices are linked to it.")
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete customer: {len(customer_sales)} sales invoices are linked to it."
            )
        
    try:
        customer_name = customer.Name
        db.delete(customer)
        db.commit()
        logger.info(f"AUDIT: User {current_user.Username} successfully deleted customer {customer_id} ({customer_name}).")
        return {"success": True, "message": "Customer deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} encountered IntegrityError deleting customer {customer_id}. Error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this customer due to database constraints."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to delete customer {customer_id}. Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the customer")
