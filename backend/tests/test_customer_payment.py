import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, Customer, Medicine, StockBatch, Sale, SaleItem, CustomerPayment, AuditLog, Category, Company
from api.v1.customer import get_customer_due_details, compute_customer_balance_map

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_customer_due_payment_flow(db: Session):
    # 1. Ensure test admin user exists
    user = db.query(User).filter(User.Username == "admin").first()
    if not user:
        user = User(
            Username="admin_test",
            PasswordHash="dummy",
            Salt="dummy",
            FullName="Test Admin",
            Role="admin"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Create a test customer
    test_cust = Customer(
        Name=f"Payment Test Customer {datetime.now().strftime('%H%M%S')}",
        Phone="03001234567",
        Address="Test Area",
        DueBalance=0.0,
        IsActive=True
    )
    db.add(test_cust)
    db.commit()
    db.refresh(test_cust)
    cid = test_cust.CustomerId

    # 3. Create a medicine and batch for sale if needed
    cat = db.query(Category).first()
    comp = db.query(Company).first()
    med = db.query(Medicine).first()
    batch = db.query(StockBatch).filter(StockBatch.MedicineId == med.MedicineId, StockBatch.Quantity > 0).first()

    # 4. Create a credit sale with GrandTotal = 1200, PaidAmount = 400 (Due = 800)
    inv_no = f"INV-PAYTEST-{datetime.now().strftime('%H%M%S')}"
    test_sale = Sale(
        InvoiceNumber=inv_no,
        CustomerId=cid,
        UserId=user.UserId,
        SubTotal=Decimal("1200.00"),
        DiscountAmount=Decimal("0.00"),
        TaxAmount=Decimal("0.00"),
        GrandTotal=Decimal("1200.00"),
        NetAmount=Decimal("1200.00"),
        PaidAmount=Decimal("400.00"),
        PaymentMethod="Credit",
        Status="Pending",
        TransactionDate=datetime.utcnow()
    )
    db.add(test_sale)
    db.commit()
    db.refresh(test_sale)

    # Verify initial due details
    due_sales, current_due = get_customer_due_details(db, test_cust)
    assert current_due == 800.0, f"Expected 800.0 due, got {current_due}"
    assert len(due_sales) == 1
    assert due_sales[0][0].InvoiceNumber == inv_no
    assert due_sales[0][2] == 800.0

    balance_map = compute_customer_balance_map(db, [cid])
    assert balance_map.get(cid) == 800.0

    # 5. Test partial payment of 300
    payment_record = CustomerPayment(
        PaymentReceiptNumber=f"REC-TEST-0001-{cid}",
        CustomerId=cid,
        UserId=user.UserId,
        SalesId=test_sale.SalesId,
        Amount=Decimal("300.00"),
        PaymentMethod="Cash",
        PaymentDate=datetime.utcnow(),
        Notes="Partial payment test",
        InvoicesCovered=f"{inv_no} (Rs 300.00)"
    )
    db.add(payment_record)

    # Allocate to sale
    test_sale.PaidAmount = float(test_sale.PaidAmount) + 300.0
    new_due = current_due - 300.0
    test_cust.DueBalance = new_due

    audit = AuditLog(
        UserId=user.UserId,
        Action="Customer Payment Received",
        Description=f"Received payment of Rs 300.00 for customer {test_cust.Name}"
    )
    db.add(audit)
    db.commit()

    # Re-verify due
    due_sales, current_due = get_customer_due_details(db, test_cust)
    assert current_due == 500.0, f"Expected 500.0 due after partial payment, got {current_due}"
    assert test_sale.Status == "Pending"
    assert float(test_sale.PaidAmount) == 700.0

    # 6. Test full payment of remaining 500
    payment_record_2 = CustomerPayment(
        PaymentReceiptNumber=f"REC-TEST-0002-{cid}",
        CustomerId=cid,
        UserId=user.UserId,
        SalesId=test_sale.SalesId,
        Amount=Decimal("500.00"),
        PaymentMethod="Bank Transfer",
        PaymentDate=datetime.utcnow(),
        Notes="Final full payment test",
        InvoicesCovered=f"{inv_no} (Rs 500.00)"
    )
    db.add(payment_record_2)

    test_sale.PaidAmount = float(test_sale.PaidAmount) + 500.0
    test_sale.Status = "Completed"
    test_cust.DueBalance = 0.0

    db.commit()

    # Verify customer is now fully paid
    due_sales, current_due = get_customer_due_details(db, test_cust)
    assert current_due == 0.0, f"Expected 0.0 due after full payment, got {current_due}"
    assert len(due_sales) == 0
    assert test_sale.Status == "Completed"
    assert float(test_sale.PaidAmount) == 1200.0

    # Verify payment history query
    payments = db.query(CustomerPayment).filter(CustomerPayment.CustomerId == cid).order_by(CustomerPayment.PaymentDate.desc()).all()
    assert len(payments) == 2
    assert payments[0].PaymentReceiptNumber == f"REC-TEST-0002-{cid}"
    assert float(payments[0].Amount) == 500.0
    assert payments[1].PaymentReceiptNumber == f"REC-TEST-0001-{cid}"
    assert float(payments[1].Amount) == 300.0

    # Cleanup test records
    for p in payments:
        db.delete(p)
    db.delete(test_sale)
    db.delete(test_cust)
    db.commit()


def test_customer_payment_api_endpoints(db: Session):
    from fastapi.testclient import TestClient
    from main import app
    from api.deps import get_current_user

    # Create admin user mock
    user = db.query(User).filter(User.Username == "admin").first()
    if not user:
        user = db.query(User).first()

    # Override current_user
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        # 1. Create a customer
        c_res = client.post("/api/v1/customers", json={
            "Name": f"API Test Customer {datetime.now().strftime('%H%M%S')}",
            "Phone": "03111234567",
            "Address": "API Area"
        })
        assert c_res.status_code == 200, c_res.text
        cid = c_res.json()["data"]["CustomerId"]

        # 2. Create a credit sale for this customer
        # Find a medicine and batch
        batch = db.query(StockBatch).filter(StockBatch.Quantity >= 5).first()
        assert batch is not None, "Need at least one batch with quantity"

        sale_payload = {
            "CustomerId": cid,
            "SubTotal": 500.0,
            "DiscountAmount": 0.0,
            "TaxAmount": 0.0,
            "GrandTotal": 500.0,
            "PaidAmount": 200.0,
            "PaymentMethod": "Credit",
            "Items": [
                {
                    "MedicineId": batch.MedicineId,
                    "BatchId": batch.BatchId,
                    "Quantity": 1,
                    "UnitPrice": 500.0,
                    "Discount": 0.0,
                    "TaxPercent": 0.0,
                    "LineTotal": 500.0,
                    "RequiresPrescription": False
                }
            ]
        }
        s_res = client.post("/api/v1/sales", json=sale_payload)
        assert s_res.status_code == 200, s_res.text
        sales_id = s_res.json()["data"]["SalesId"]
        inv_no = s_res.json()["data"]["InvoiceNumber"]

        # 3. Check customer list and due-details
        due_res = client.get(f"/api/v1/customers/{cid}/due-details")
        assert due_res.status_code == 200, due_res.text
        due_data = due_res.json()["data"]
        assert due_data["CurrentBalanceDue"] == 300.0
        assert len(due_data["PendingInvoices"]) == 1
        assert due_data["PendingInvoices"][0]["DueAmount"] == 300.0

        # 4. Verify validation: payment > 300 fails
        fail_res = client.post(f"/api/v1/customers/{cid}/receive-payment", json={
            "Amount": 350.0,
            "PaymentMethod": "Cash"
        })
        assert fail_res.status_code == 400
        assert "cannot exceed" in fail_res.json()["detail"]

        # 5. Verify validation: payment <= 0 fails
        fail_res2 = client.post(f"/api/v1/customers/{cid}/receive-payment", json={
            "Amount": 0.0,
            "PaymentMethod": "Cash"
        })
        assert fail_res2.status_code in (400, 422)

        # 6. Make partial payment of 100.0
        pay_res = client.post(f"/api/v1/customers/{cid}/receive-payment", json={
            "Amount": 100.0,
            "PaymentMethod": "Cash",
            "Notes": "First partial instalment"
        })
        assert pay_res.status_code == 200, pay_res.text
        pay_data = pay_res.json()["data"]
        assert pay_data["Amount"] == 100.0
        assert pay_data["RemainingBalanceDue"] == 200.0
        assert pay_data["IsFullyPaid"] == False

        # 7. Check payment history endpoint
        hist_res = client.get(f"/api/v1/customers/{cid}/payments")
        assert hist_res.status_code == 200, hist_res.text
        hist_data = hist_res.json()["data"]
        assert len(hist_data) == 1
        assert hist_data[0]["Amount"] == 100.0
        assert "INV-" in hist_data[0]["InvoicesCovered"]

        # 8. Complete final payment of 200.0
        pay_res2 = client.post(f"/api/v1/customers/{cid}/receive-payment", json={
            "Amount": 200.0,
            "PaymentMethod": "Card",
            "Notes": "Final clearance"
        })
        assert pay_res2.status_code == 200, pay_res2.text
        pay_data2 = pay_res2.json()["data"]
        assert pay_data2["Amount"] == 200.0
        assert pay_data2["RemainingBalanceDue"] == 0.0
        assert pay_data2["IsFullyPaid"] == True

        # 9. Verify customer in paid list and not in due list
        c_list_paid = client.get("/api/v1/customers?balance_filter=paid&page_size=100")
        assert c_list_paid.status_code == 200
        paid_cids = [c["CustomerId"] for c in c_list_paid.json()["data"]]
        assert cid in paid_cids

        c_list_due = client.get("/api/v1/customers?balance_filter=due&page_size=100")
        assert c_list_due.status_code == 200
        due_cids = [c["CustomerId"] for c in c_list_due.json()["data"]]
        assert cid not in due_cids

        # 10. Verify sales history shows the sale as completed and full paid
        sale_obj = db.query(Sale).filter(Sale.SalesId == sales_id).first()
        assert sale_obj.Status == "Completed"
        assert float(sale_obj.PaidAmount) == 500.0

        # 11. Verify payments history now has 2 entries
        hist_res2 = client.get(f"/api/v1/customers/{cid}/payments")
        assert len(hist_res2.json()["data"]) == 2

        # Cleanup
        payments = db.query(CustomerPayment).filter(CustomerPayment.CustomerId == cid).all()
        for p in payments:
            db.delete(p)
        sale_items = db.query(SaleItem).filter(SaleItem.SalesId == sales_id).all()
        for si in sale_items:
            db.delete(si)
        db.delete(sale_obj)
        cust_obj = db.query(Customer).filter(Customer.CustomerId == cid).first()
        if cust_obj:
            db.delete(cust_obj)
        db.commit()

    finally:
        app.dependency_overrides.clear()
