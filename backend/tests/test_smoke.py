"""Phase 0 smoke test — proves the isolated test harness round-trip.

Run via:  python -m testenv.run_tests
Server:  http://127.0.0.1:8123/api/v1  (isolated DB in the temp test dir)
"""
import httpx

BASE = "http://127.0.0.1:8123/api/v1"


def test_public_billing_get():
    r = httpx.get(f"{BASE}/settings/billing")
    assert r.status_code == 200
    assert "CurrencySymbol" in r.json()


def test_login_and_me():
    r = httpx.post(
        f"{BASE}/auth/login",
        data={"username": "admin", "password": "admin"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = httpx.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"
    assert me.json()["role"] == "admin"


def test_authenticated_write():
    login = httpx.post(
        f"{BASE}/auth/login",
        data={"username": "admin", "password": "admin"},
    )
    token = login.json()["access_token"]
    payload = {
        "Currency": "Rs",
        "CurrencySymbol": "Rs",
        "TaxEnabled": False,
        "DefaultTaxRate": 0.0,
        "DiscountEnabled": False,
        "MaxDiscountPercentage": 10.0,
        "AdminDiscountThreshold": 1000.0,
        "RequireAdminPinForDiscount": False,
        "InvoicePrefix": "INV-",
        "NextInvoiceNumber": 1,
        "DefaultPaymentMethod": "Cash",
        "AutoPrintReceipt": False,
        "ShowKeyboardShortcuts": True,
    }
    r = httpx.put(
        f"{BASE}/settings/billing",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200