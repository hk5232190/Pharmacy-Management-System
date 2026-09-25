from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func, case, and_
from typing import List, Optional
from datetime import datetime, timezone
import csv
import io
import uuid

from models import Customer, Sale, CustomerPayment, AuditLog, User
from schemas.customer import (
    CustomerCreate, 
    CustomerUpdate, 
    CustomerResponse, 
    CustomerPaymentCreate, 
    CustomerPaymentResponse
)
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

router = APIRouter()

def utc_to_local_str(dt_obj):
    if not dt_obj:
        return ""
    try:
        return dt_obj.replace(tzinfo=timezone.utc).astimezone().strftime('%d/%m/%Y, %I:%M %p')
    except Exception:
        return str(dt_obj)

def compute_customer_balance_map(db: Session, customer_ids: list) -> dict:
    if not customer_ids:
        return {}
    effective_due = case(
        (Sale.Status.in_(["Returned", "Fully Refunded", "Cancelled"]), 0),
        (
            and_(Sale.ReturnedAmount > 0, Sale.NetAmount != None),
            case((Sale.NetAmount > Sale.PaidAmount, Sale.NetAmount - Sale.PaidAmount), else_=0)
        ),
        else_=case((Sale.GrandTotal > Sale.PaidAmount, Sale.GrandTotal - Sale.PaidAmount), else_=0)
    )
    rows = (
        db.query(Sale.CustomerId, func.sum(effective_due))
        .filter(
            Sale.CustomerId.in_(customer_ids),
            ~Sale.Status.in_(["Returned", "Fully Refunded", "Cancelled"]),
            or_(
                and_(Sale.ReturnedAmount > 0, Sale.NetAmount > Sale.PaidAmount),
                and_(or_(Sale.ReturnedAmount == 0, Sale.ReturnedAmount == None), Sale.GrandTotal > Sale.PaidAmount)
            )
        )
        .group_by(Sale.CustomerId)
        .all()
    )
    return {cid: round(float(bal or 0), 2) for cid, bal in rows}

def get_customer_due_details(db: Session, customer: Customer):
    """
    Returns:
      due_sales: list of (Sale, target_total, due_amount) ordered FIFO (TransactionDate asc, SalesId asc)
      total_due: float (real outstanding balance)
    """
    sales = (
        db.query(Sale)
        .filter(
            Sale.CustomerId == customer.CustomerId,
            ~Sale.Status.in_(["Returned", "Fully Refunded", "Cancelled"])
        )
        .order_by(Sale.TransactionDate.asc(), Sale.SalesId.asc())
        .all()
    )

    due_sales = []
    total_sales_due = 0.0

    for s in sales:
        target_amount = float(s.NetAmount) if (s.ReturnedAmount and s.ReturnedAmount > 0 and s.NetAmount is not None) else float(s.GrandTotal)
        paid = float(s.PaidAmount or 0)
        due = round(max(0.0, target_amount - paid), 2)
        if due > 0.001:
            due_sales.append((s, target_amount, due))
            total_sales_due += due

    total_sales_due = round(total_sales_due, 2)
    recorded_due = round(float(customer.DueBalance or 0), 2)
    real_due = max(total_sales_due, recorded_due)

    return due_sales, real_due

@router.get("", summary="Get all customers")
def get_customers(
    search: str = Query(None, description="Search by customer name or phone"),
    status: str = Query(None, description="Filter by status (active/inactive)"),
    balance_filter: str = Query(None, description="Filter by payment status: all | paid | due"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=0, description="Items per page. 0 for all."),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Exclude the default walk-in customer (CustomerId 0) from the UI list
    query = db.query(Customer).filter(Customer.CustomerId != 0)

    if search:
        query = query.filter(
            or_(
                Customer.Name.ilike(f"%{search}%"),
                Customer.Phone.ilike(f"%{search}%")
            )
        )

    if status and status.lower() != 'all':
        is_active = status.lower() == 'active'
        query = query.filter(Customer.IsActive == is_active)

    # Fetch all matching customers (balance filter requires post-query computation)
    all_customers = query.order_by(Customer.CustomerId).all()

    # Compute live BalanceDue per customer with returns accounted for
    customer_ids = [c.CustomerId for c in all_customers]
    balance_map = compute_customer_balance_map(db, customer_ids)

    def get_effective_balance(c):
        bal = balance_map.get(c.CustomerId, 0.0)
        if bal <= 0 and float(c.DueBalance or 0) > 0:
            bal = round(float(c.DueBalance), 2)
        return bal

    # Apply balance_filter on computed values
    if balance_filter and balance_filter.lower() == 'due':
        all_customers = [c for c in all_customers if get_effective_balance(c) > 0]
    elif balance_filter and balance_filter.lower() == 'paid':
        all_customers = [c for c in all_customers if get_effective_balance(c) <= 0]

    total = len(all_customers)

    # Paginate after filtering
    if page_size > 0:
        paged = all_customers[(page - 1) * page_size: page * page_size]
    else:
        paged = all_customers

    result = []
    for c in paged:
        bal = get_effective_balance(c)
        result.append({
            "CustomerId": c.CustomerId,
            "Name": c.Name,
            "Phone": c.Phone,
            "Address": c.Address,
            "LoyaltyPoints": c.LoyaltyPoints,
            "IsActive": c.IsActive,
            "BalanceDue": bal,
            "DueBalance": bal,
        })

    return {"success": True, "data": result, "total": total, "page": page, "page_size": page_size}

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
        Address=customer_in.Address,
        LoyaltyPoints=customer_in.LoyaltyPoints,
        DueBalance=customer_in.DueBalance,
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
    if customer_id == 0:
        raise HTTPException(status_code=403, detail="Cannot edit the default Walk-in Customer")
        
    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    if customer_in.Name is not None:
        customer.Name = customer_in.Name
    if customer_in.Phone is not None:
        customer.Phone = customer_in.Phone
    if customer_in.Address is not None:
        customer.Address = customer_in.Address
    if customer_in.LoyaltyPoints is not None:
        customer.LoyaltyPoints = customer_in.LoyaltyPoints
    if customer_in.DueBalance is not None:
        customer.DueBalance = customer_in.DueBalance
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
    if customer_id == 0:
        raise HTTPException(status_code=403, detail="Cannot toggle status of the default Walk-in Customer")
        
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
        customers = db.query(Customer).filter(Customer.CustomerId != 0).order_by(Customer.CustomerId).all()

        # Compute live BalanceDue for all customers
        customer_ids = [c.CustomerId for c in customers]
        balance_map = compute_customer_balance_map(db, customer_ids)

        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(["Code", "Name", "Phone", "Address", "Balance Due", "Loyalty Points", "Status"])

        # Write rows
        for cust in customers:
            code = f"CUST-{str(cust.CustomerId).zfill(5)}"
            balance_due = balance_map.get(cust.CustomerId, 0.0)
            if balance_due <= 0 and float(cust.DueBalance or 0) > 0:
                balance_due = round(float(cust.DueBalance), 2)
            status = "Active" if cust.IsActive else "Inactive"
            writer.writerow([code, cust.Name, cust.Phone or "", cust.Address or "", balance_due, cust.LoyaltyPoints, status])

        logger.info(f"AUDIT: User {current_user.Username} exported {len(customers)} customers to CSV.")

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=customers_export.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting customers: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export customers")

@router.post("/import", summary="Import customers from CSV or Excel")
def import_customers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    fname_lower = (file.filename or '').lower()
    if not (fname_lower.endswith('.csv') or fname_lower.endswith('.xlsx') or fname_lower.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are allowed")
        
    try:
        contents = file.file.read()
        
        rows = []
        if fname_lower.endswith('.csv'):
            decoded = contents.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(decoded))
            rows = list(csv_reader)
        else:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            sheet_rows = list(sheet.iter_rows(values_only=True))
            if sheet_rows:
                headers = [str(cell).strip() if cell is not None else "" for cell in sheet_rows[0]]
                for row in sheet_rows[1:]:
                    if any(cell is not None and str(cell).strip() for cell in row):
                        row_dict = {headers[i]: str(cell).strip() if cell is not None else "" for i, cell in enumerate(row) if i < len(headers)}
                        rows.append(row_dict)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for row_idx, row in enumerate(rows, start=2): # Row 1 is header
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


@router.get("/{customer_id}/due-details", summary="Get detailed due balance and pending invoices for a customer")
def get_customer_due_details_endpoint(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if customer_id == 0:
        return {
            "success": True,
            "data": {
                "CustomerId": 0,
                "Name": "Walk-in Customer",
                "CurrentBalanceDue": 0.0,
                "PendingInvoices": []
            }
        }

    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    due_sales, current_due = get_customer_due_details(db, customer)

    pending_invoices = []
    for s, target_total, due in due_sales:
        pending_invoices.append({
            "SalesId": s.SalesId,
            "InvoiceNumber": s.InvoiceNumber,
            "GrandTotal": target_total,
            "PaidAmount": float(s.PaidAmount or 0),
            "DueAmount": due,
            "TransactionDate": utc_to_local_str(s.TransactionDate)
        })

    return {
        "success": True,
        "data": {
            "CustomerId": customer.CustomerId,
            "Name": customer.Name,
            "CurrentBalanceDue": current_due,
            "PendingInvoices": pending_invoices
        }
    }


@router.post("/{customer_id}/receive-payment", response_model=BaseResponse[CustomerPaymentResponse], summary="Receive payment for customer outstanding balance")
def receive_customer_payment(
    customer_id: int,
    payment_in: CustomerPaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if customer_id == 0:
        raise HTTPException(status_code=400, detail="Cannot receive balance payment for the default Walk-in Customer.")

    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    due_sales, current_due = get_customer_due_details(db, customer)

    if current_due <= 0:
        raise HTTPException(status_code=400, detail=f"Customer {customer.Name} has no outstanding balance due.")

    if payment_in.Amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    if round(payment_in.Amount, 2) > round(current_due, 2):
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount (Rs {payment_in.Amount:.2f}) cannot exceed current balance due (Rs {current_due:.2f})."
        )

    # Allocate payment to due sales in FIFO order
    remaining_payment = round(payment_in.Amount, 2)
    covered_invoices = []
    primary_sales_id = None

    for sale_obj, target_amount, sale_due in due_sales:
        if remaining_payment <= 0.001:
            break

        allocated = min(remaining_payment, sale_due)
        new_paid = round(float(sale_obj.PaidAmount or 0) + allocated, 2)
        sale_obj.PaidAmount = new_paid

        # If sale is now paid in full, update status to Completed
        if new_paid >= target_amount - 0.001:
            if sale_obj.Status == "Pending":
                sale_obj.Status = "Completed"

        covered_invoices.append(f"{sale_obj.InvoiceNumber} (Rs {allocated:.2f})")
        if primary_sales_id is None:
            primary_sales_id = sale_obj.SalesId

        remaining_payment = round(remaining_payment - allocated, 2)

    # Update customer DueBalance
    new_balance = max(0.0, round(current_due - payment_in.Amount, 2))
    customer.DueBalance = new_balance

    # Generate sequential receipt number
    now = datetime.now()
    date_str = now.strftime('%Y%m')
    payment_count = db.query(func.count(CustomerPayment.PaymentId)).scalar() or 0
    receipt_no = f"PAY-{date_str}-{str(payment_count + 1).zfill(4)}"

    # Check for collision
    collision = db.query(CustomerPayment).filter(CustomerPayment.PaymentReceiptNumber == receipt_no).first()
    if collision:
        receipt_no = f"PAY-{date_str}-{uuid.uuid4().hex[:4].upper()}"

    # Payment date
    p_date = datetime.utcnow()
    if payment_in.PaymentDate:
        try:
            cleaned_date = payment_in.PaymentDate.replace("Z", "+00:00")
            p_date = datetime.fromisoformat(cleaned_date)
            if p_date.tzinfo is not None:
                p_date = p_date.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            p_date = datetime.utcnow()

    # Create CustomerPayment record
    invoices_str = ", ".join(covered_invoices) if covered_invoices else "Direct Balance Adjustment"
    payment_record = CustomerPayment(
        PaymentReceiptNumber=receipt_no,
        CustomerId=customer.CustomerId,
        UserId=current_user.UserId,
        SalesId=primary_sales_id if len(covered_invoices) == 1 else None,
        Amount=payment_in.Amount,
        PaymentMethod=payment_in.PaymentMethod or "Cash",
        PaymentDate=p_date,
        Notes=payment_in.Notes,
        InvoicesCovered=invoices_str
    )
    db.add(payment_record)
    db.flush()

    # Create AuditLog record
    audit_desc = (
        f"Received payment of Rs {payment_in.Amount:.2f} via {payment_in.PaymentMethod} "
        f"from customer {customer.Name} (CUST-{customer.CustomerId:05d}). "
        f"Receipt: {receipt_no}. Invoices: {invoices_str}. "
        f"Previous Due: Rs {current_due:.2f}, New Due: Rs {new_balance:.2f}."
    )
    if payment_in.Notes:
        audit_desc += f" Note: {payment_in.Notes}"

    audit = AuditLog(
        UserId=current_user.UserId,
        Action="Customer Payment Received",
        Description=audit_desc
    )
    db.add(audit)

    db.commit()
    db.refresh(payment_record)

    logger.info(f"AUDIT: User {current_user.Username} received customer payment {receipt_no} of Rs {payment_in.Amount:.2f} from {customer.Name}.")

    response_data = CustomerPaymentResponse(
        PaymentId=payment_record.PaymentId,
        PaymentReceiptNumber=payment_record.PaymentReceiptNumber,
        CustomerId=customer.CustomerId,
        CustomerName=customer.Name,
        Amount=float(payment_record.Amount),
        PaymentMethod=payment_record.PaymentMethod,
        PaymentDate=utc_to_local_str(payment_record.PaymentDate),
        Notes=payment_record.Notes,
        InvoicesCovered=payment_record.InvoicesCovered,
        CashierName=current_user.Username,
        RemainingBalanceDue=new_balance,
        IsFullyPaid=(new_balance <= 0)
    )

    return {
        "success": True,
        "data": response_data,
        "message": f"Payment of Rs {payment_in.Amount:.2f} received successfully. Remaining due: Rs {new_balance:.2f}."
    }


@router.get("/{customer_id}/payments", response_model=BaseResponse[List[CustomerPaymentResponse]], summary="Get customer payment history")
def get_customer_payment_history(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if customer_id == 0:
        return {"success": True, "data": []}

    customer = db.query(Customer).filter(Customer.CustomerId == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    payments = (
        db.query(CustomerPayment)
        .options(joinedload(CustomerPayment.user))
        .filter(CustomerPayment.CustomerId == customer_id)
        .order_by(CustomerPayment.PaymentDate.desc())
        .all()
    )

    results = []
    for p in payments:
        cashier = p.user.Username if p.user else "Admin"
        results.append(CustomerPaymentResponse(
            PaymentId=p.PaymentId,
            PaymentReceiptNumber=p.PaymentReceiptNumber,
            CustomerId=p.CustomerId,
            CustomerName=customer.Name,
            Amount=float(p.Amount),
            PaymentMethod=p.PaymentMethod,
            PaymentDate=utc_to_local_str(p.PaymentDate),
            Notes=p.Notes,
            InvoicesCovered=p.InvoicesCovered,
            CashierName=cashier,
            RemainingBalanceDue=None,
            IsFullyPaid=None
        ))

    return {"success": True, "data": results}


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

    # Check for linked payments
    customer_payments = db.query(CustomerPayment).filter(CustomerPayment.CustomerId == customer_id).all()
    if customer_payments:
        logger.warning(f"AUDIT: User {current_user.Username} attempted to delete customer {customer_id} ({customer.Name}) but was blocked. Reason: Payment records are linked to it.")
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete customer: {len(customer_payments)} payment records are linked to it."
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

