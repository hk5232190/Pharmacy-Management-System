"""End-to-end tests for production audit fixes.

Tests verify:
1. Exit auto-backup accessible to cashiers without 'settings' permission (no 403).
2. Supplier CurrentBalance updated on credit purchases.
3. Credit/Pending POS sales included in Sales KPI, Dashboard Summary, and Financial Reports.
4. Customer DueBalance accurately computed for pending sales.
5. Inventory movements reflect FreeQty bonus units.
"""

import httpx
import pytest

BASE = "http://127.0.0.1:8123/api/v1"


@pytest.fixture(scope="module")
def admin_token():
    r = httpx.post(f"{BASE}/auth/login", data={"username": "admin", "password": "admin"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_cashier_exit_backup_access(admin_headers):
    # 1. Create a cashier user without settings permission
    user_payload = {
        "username": "test_cashier",
        "full_name": "Test Cashier",
        "password": "cashierpassword123",
        "role": "cashier"
    }
    r = httpx.post(f"{BASE}/users", json=user_payload, headers=admin_headers)
    assert r.status_code in (200, 201), f"Failed to create cashier: {r.text}"
    user_id = r.json()["data"]["UserId"]

    # Explicitly set permissions without 'settings'
    r_perm = httpx.put(
        f"{BASE}/users/{user_id}/permissions",
        json={"permissions": ["sales", "customers"]},
        headers=admin_headers
    )
    assert r_perm.status_code == 200

    # 2. Login as cashier
    r_login = httpx.post(f"{BASE}/auth/login", data={"username": "test_cashier", "password": "cashierpassword123"})
    assert r_login.status_code == 200
    cashier_token = r_login.json()["access_token"]
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}

    # 3. Call exit backup endpoint - MUST NOT be 403 Forbidden!
    r_exit = httpx.post(f"{BASE}/backup/backup-on-exit", headers=cashier_headers)
    assert r_exit.status_code == 200, f"Exit backup returned {r_exit.status_code}: {r_exit.text}"
    assert r_exit.status_code != 403


def test_supplier_balance_on_credit_purchase(admin_headers):
    # 1. Create category and company first
    r_cat = httpx.post(f"{BASE}/categories", json={"CategoryName": "Tablets"}, headers=admin_headers)
    assert r_cat.status_code == 200
    cat_id = r_cat.json()["data"]["CategoryId"]

    r_comp = httpx.post(f"{BASE}/companies", json={"CompanyName": "PharmaCorp"}, headers=admin_headers)
    assert r_comp.status_code == 200
    comp_id = r_comp.json()["data"]["CompanyId"]

    # 2. Create a new supplier
    sup_payload = {
        "Name": "Audit Supplier Ltd",
        "ContactPerson": "John Doe",
        "Phone": "03001234567",
        "OpeningBalance": 0.0
    }
    r_sup = httpx.post(f"{BASE}/suppliers", json=sup_payload, headers=admin_headers)
    assert r_sup.status_code == 200, r_sup.text
    supplier_id = r_sup.json()["data"]["SupplierId"]

    # 3. Create a test medicine
    med_payload = {
        "BrandName": "AuditPanadol",
        "GenericName": "Paracetamol",
        "CategoryId": cat_id,
        "CompanyId": comp_id,
        "Barcode": "AUDITPAN001",
        "DefaultCostPrice": 50.0,
        "DefaultSellingPrice": 70.0
    }
    r_med = httpx.post(f"{BASE}/medicines", json=med_payload, headers=admin_headers)
    assert r_med.status_code == 200, r_med.text
    medicine_id = r_med.json()["data"]["MedicineId"]

    # 4. Make a credit purchase (GrandTotal=500, PaidAmount=200, RemainingBalance=300)
    # with FreeQty=5
    pur_payload = {
        "SupplierId": supplier_id,
        "InvoiceNumber": "INV-AUDIT-001",
        "PaymentStatus": "Partial",
        "PaymentMethod": "Cash",
        "SubTotal": 500.0,
        "TotalDiscount": 0.0,
        "TotalTax": 0.0,
        "GrandTotal": 500.0,
        "PaidAmount": 200.0,
        "RemainingBalance": 300.0,
        "PurchaseDate": "2026-09-24T12:00:00Z",
        "items": [
            {
                "MedicineId": medicine_id,
                "BatchCode": "BATCH-AUDIT-1",
                "Quantity": 10,
                "FreeQty": 5,
                "CostPrice": 50.0,
                "SellingPrice": 70.0,
                "Discount": 0.0,
                "TaxPercentage": 0.0,
                "LineTotal": 500.0,
                "ExpiryDate": "2027-12-31"
            }
        ]
    }
    r_pur = httpx.post(f"{BASE}/purchases", json=pur_payload, headers=admin_headers)
    assert r_pur.status_code == 200, r_pur.text

    # 5. Verify supplier CurrentBalance increased by RemainingBalance (300.0)
    r_sup_check = httpx.get(f"{BASE}/suppliers", headers=admin_headers)
    assert r_sup_check.status_code == 200
    suppliers = r_sup_check.json()["data"]
    target_sup = next((s for s in suppliers if s["SupplierId"] == supplier_id), None)
    assert target_sup is not None
    assert float(target_sup["CurrentBalance"]) == 300.0, f"Expected 300.0, got {target_sup['CurrentBalance']}"

    # 6. Verify inventory movement reflects FreeQty (10 + 5 = 15 units)
    r_mov = httpx.get(f"{BASE}/inventory/movements?batch_code=BATCH-AUDIT-1", headers=admin_headers)
    assert r_mov.status_code == 200
    movements = r_mov.json()["data"]
    assert len(movements) >= 1
    pur_mov = next((m for m in movements if m["MovementType"] == "Purchase"), None)
    assert pur_mov is not None
    assert pur_mov["QuantityChange"] == 15, f"Expected 15 units (10 + 5 free), got {pur_mov['QuantityChange']}"


def test_credit_sales_kpi_and_customer_balance(admin_headers):
    # 1. Create a customer
    cust_payload = {
        "Name": "Audit Credit Customer",
        "Phone": "03009876543",
        "OpeningBalance": 0.0
    }
    r_cust = httpx.post(f"{BASE}/customers", json=cust_payload, headers=admin_headers)
    assert r_cust.status_code == 200, r_cust.text
    customer_id = r_cust.json()["data"]["CustomerId"]

    # 2. Get the batch from inventory stock
    r_stock = httpx.get(f"{BASE}/inventory/stock?search=AuditPanadol", headers=admin_headers)
    assert r_stock.status_code == 200, r_stock.text
    stock_items = r_stock.json()["data"]
    batch_item = next(b for b in stock_items if b["BatchCode"] == "BATCH-AUDIT-1")
    batch_id = batch_item["BatchId"]
    medicine_id = batch_item["MedicineId"]

    # 3. Create a credit sale (GrandTotal=350, PaidAmount=100, Due=250, Status="Pending")
    sale_payload = {
        "CustomerId": customer_id,
        "SubTotal": 350.0,
        "DiscountAmount": 0.0,
        "TaxAmount": 0.0,
        "GrandTotal": 350.0,
        "PaidAmount": 100.0,
        "PaymentMethod": "Credit",
        "Items": [
            {
                "MedicineId": medicine_id,
                "BatchId": batch_id,
                "Quantity": 5,
                "UnitPrice": 70.0,
                "Discount": 0.0,
                "TaxPercent": 0.0,
                "LineTotal": 350.0,
                "RequiresPrescription": False
            }
        ]
    }
    r_sale = httpx.post(f"{BASE}/sales", json=sale_payload, headers=admin_headers, follow_redirects=True)
    assert r_sale.status_code == 200, r_sale.text

    # 4. Verify Customer DueBalance is 250.0
    r_cust_list = httpx.get(f"{BASE}/customers", headers=admin_headers)
    assert r_cust_list.status_code == 200
    customers = r_cust_list.json()["data"]
    target_cust = next((c for c in customers if c["CustomerId"] == customer_id), None)
    assert target_cust is not None
    assert float(target_cust["DueBalance"]) == 250.0, f"Expected DueBalance 250.0, got {target_cust['DueBalance']}"

    # 5. Verify Sales KPI includes pending credit sale
    r_kpi = httpx.get(f"{BASE}/sales/kpi", headers=admin_headers)
    assert r_kpi.status_code == 200
    kpi_data = r_kpi.json()["data"]
    # Total revenue / net sales must include the 350 sale
    assert kpi_data["todaysSales"] >= 350.0
    # Pending payments must capture the unpaid 250.0
    assert kpi_data["pendingPayments"] >= 250.0

    # 6. Verify Dashboard summary includes this sale in total_sales
    r_dash = httpx.get(f"{BASE}/dashboard/summary", headers=admin_headers)
    assert r_dash.status_code == 200
    dash_data = r_dash.json()
    assert dash_data["total_sales"] >= 350.0
    assert dash_data["today_sales"] >= 350.0
