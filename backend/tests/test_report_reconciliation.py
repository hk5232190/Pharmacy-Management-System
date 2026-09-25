import pytest
import tempfile
import os
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
import models
from api.v1.reports import fetch_sales_report_data, fetch_financial_report_data


@pytest.fixture
def isolated_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_reconciliation.sqlite")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        try:
            os.remove(db_path)
            os.rmdir(temp_dir)
        except Exception:
            pass


def test_sales_vs_financial_report_reconciliation(isolated_db):
    db = isolated_db
    today = date.today()

    # 1. Seed Master Entities
    user = models.User(
        Username="auditor",
        PasswordHash="hash",
        Salt="salt",
        FullName="Auditor Test",
        Role="admin"
    )
    cat = models.Category(CategoryName="General", IsActive=True)
    comp = models.Company(CompanyName="Pharma Inc", IsActive=True)
    cust = models.Customer(Name="Reconciliation Customer", Phone="03001112233", DueBalance=0.0, IsActive=True)
    db.add_all([user, cat, comp, cust])
    db.commit()

    med1 = models.Medicine(BrandName="MedAlpha", GenericName="GenA", CategoryId=cat.CategoryId, CompanyId=comp.CompanyId, IsActive=True)
    med2 = models.Medicine(BrandName="MedBeta", GenericName="GenB", CategoryId=cat.CategoryId, CompanyId=comp.CompanyId, IsActive=True)
    db.add_all([med1, med2])
    db.commit()

    batch1 = models.StockBatch(MedicineId=med1.MedicineId, BatchCode="B1", Quantity=100, CostPrice=Decimal("100.00"), SellingPrice=Decimal("150.00"), ExpiryDate=today + timedelta(days=365))
    batch2 = models.StockBatch(MedicineId=med2.MedicineId, BatchCode="B2", Quantity=100, CostPrice=Decimal("200.00"), SellingPrice=Decimal("300.00"), ExpiryDate=today + timedelta(days=365))
    db.add_all([batch1, batch2])
    db.commit()

    # Sale 1: 10 units of MedAlpha @ 150 = 1500. Fully returned later.
    sale1 = models.Sale(
        InvoiceNumber="INV-TEST-001",
        CustomerId=cust.CustomerId,
        UserId=user.UserId,
        SubTotal=Decimal("1500.00"),
        DiscountAmount=Decimal("0.00"),
        TaxAmount=Decimal("0.00"),
        GrandTotal=Decimal("1500.00"),
        NetAmount=Decimal("1500.00"),
        PaidAmount=Decimal("1500.00"),
        PaymentMethod="Cash",
        Status="Completed",
        TransactionDate=datetime.now(timezone.utc)
    )
    db.add(sale1)
    db.flush()
    item1 = models.SaleItem(SalesId=sale1.SalesId, BatchId=batch1.BatchId, Quantity=10, ReturnedQuantity=0, UnitPrice=Decimal("150.00"), TotalPrice=Decimal("1500.00"))
    db.add(item1)

    # Sale 2: 10 units of MedAlpha @ 150 = 1500. Partially returned (4 units = 600 refund).
    sale2 = models.Sale(
        InvoiceNumber="INV-TEST-002",
        CustomerId=cust.CustomerId,
        UserId=user.UserId,
        SubTotal=Decimal("1500.00"),
        DiscountAmount=Decimal("0.00"),
        TaxAmount=Decimal("0.00"),
        GrandTotal=Decimal("1500.00"),
        NetAmount=Decimal("1500.00"),
        PaidAmount=Decimal("1500.00"),
        PaymentMethod="Cash",
        Status="Completed",
        TransactionDate=datetime.now(timezone.utc)
    )
    db.add(sale2)
    db.flush()
    item2 = models.SaleItem(SalesId=sale2.SalesId, BatchId=batch1.BatchId, Quantity=10, ReturnedQuantity=0, UnitPrice=Decimal("150.00"), TotalPrice=Decimal("1500.00"))
    db.add(item2)

    # Sale 3: 5 units of MedBeta @ 300 = 1500. Discount 100, Tax 50 => GrandTotal 1450. No return.
    sale3 = models.Sale(
        InvoiceNumber="INV-TEST-003",
        CustomerId=cust.CustomerId,
        UserId=user.UserId,
        SubTotal=Decimal("1500.00"),
        DiscountAmount=Decimal("100.00"),
        TaxAmount=Decimal("50.00"),
        GrandTotal=Decimal("1450.00"),
        NetAmount=Decimal("1450.00"),
        PaidAmount=Decimal("1450.00"),
        PaymentMethod="Cash",
        Status="Completed",
        TransactionDate=datetime.now(timezone.utc)
    )
    db.add(sale3)
    db.flush()
    item3 = models.SaleItem(SalesId=sale3.SalesId, BatchId=batch2.BatchId, Quantity=5, ReturnedQuantity=0, UnitPrice=Decimal("300.00"), Discount=Decimal("100.00"), Tax=Decimal("50.00"), TotalPrice=Decimal("1450.00"))
    db.add(item3)

    # Sale 4: 10 units of MedBeta @ 300 = 3000. Credit sale. Partially returned (5 units = 1500 refund).
    sale4 = models.Sale(
        InvoiceNumber="INV-TEST-004",
        CustomerId=cust.CustomerId,
        UserId=user.UserId,
        SubTotal=Decimal("3000.00"),
        DiscountAmount=Decimal("0.00"),
        TaxAmount=Decimal("0.00"),
        GrandTotal=Decimal("3000.00"),
        NetAmount=Decimal("3000.00"),
        PaidAmount=Decimal("1000.00"),
        PaymentMethod="Credit",
        Status="Pending",
        TransactionDate=datetime.now(timezone.utc)
    )
    db.add(sale4)
    db.flush()
    item4 = models.SaleItem(SalesId=sale4.SalesId, BatchId=batch2.BatchId, Quantity=10, ReturnedQuantity=0, UnitPrice=Decimal("300.00"), TotalPrice=Decimal("3000.00"))
    db.add(item4)
    db.commit()

    # Process Returns:
    # 1. Full Return on Sale 1 (10 units of MedAlpha, 1500 refund)
    ret1 = models.SaleReturn(
        SalesId=sale1.SalesId,
        UserId=user.UserId,
        ReturnInvoiceNumber="RET-TEST-001",
        TotalRefundAmount=Decimal("1500.00"),
        RefundMode="Cash Refund",
        Reason="Customer changed mind",
        ReturnDate=datetime.now(timezone.utc)
    )
    db.add(ret1)
    db.flush()
    ret_item1 = models.SaleReturnItem(ReturnId=ret1.ReturnId, BatchId=batch1.BatchId, ReturnQuantity=10, RefundAmount=Decimal("1500.00"), ItemCondition="Restockable")
    db.add(ret_item1)
    item1.ReturnedQuantity = 10
    sale1.ReturnedAmount = Decimal("1500.00")
    sale1.NetAmount = Decimal("0.00")
    sale1.Status = "Returned"

    # 2. Partial Return on Sale 2 (4 units of MedAlpha, 600 refund)
    ret2 = models.SaleReturn(
        SalesId=sale2.SalesId,
        UserId=user.UserId,
        ReturnInvoiceNumber="RET-TEST-002",
        TotalRefundAmount=Decimal("600.00"),
        RefundMode="Cash Refund",
        Reason="Excess quantity",
        ReturnDate=datetime.now(timezone.utc)
    )
    db.add(ret2)
    db.flush()
    ret_item2 = models.SaleReturnItem(ReturnId=ret2.ReturnId, BatchId=batch1.BatchId, ReturnQuantity=4, RefundAmount=Decimal("600.00"), ItemCondition="Restockable")
    db.add(ret_item2)
    item2.ReturnedQuantity = 4
    sale2.ReturnedAmount = Decimal("600.00")
    sale2.NetAmount = Decimal("900.00")
    # Status remains Completed

    # 3. Partial Return on Sale 4 (5 units of MedBeta, 1500 refund)
    ret3 = models.SaleReturn(
        SalesId=sale4.SalesId,
        UserId=user.UserId,
        ReturnInvoiceNumber="RET-TEST-003",
        TotalRefundAmount=Decimal("1500.00"),
        RefundMode="Balance",
        Reason="Patient discharged early",
        ReturnDate=datetime.now(timezone.utc)
    )
    db.add(ret3)
    db.flush()
    ret_item3 = models.SaleReturnItem(ReturnId=ret3.ReturnId, BatchId=batch2.BatchId, ReturnQuantity=5, RefundAmount=Decimal("1500.00"), ItemCondition="Restockable")
    db.add(ret_item3)
    item4.ReturnedQuantity = 5
    sale4.ReturnedAmount = Decimal("1500.00")
    sale4.NetAmount = Decimal("1500.00")
    # Status remains Pending

    db.commit()

    # Now run both reports for today
    sales_rep = fetch_sales_report_data(db, today, today)
    fin_rep = fetch_financial_report_data(db, today, today)

    # Expected values calculation:
    # Original sales:
    # Sale 1: 1500 gross (invoiced)
    # Sale 2: 1500 gross (invoiced)
    # Sale 3: 1500 subtotal, 100 discount, 50 tax => 1450 invoiced, 1550 gross before discount
    # Sale 4: 3000 gross (invoiced)
    # Total Invoiced Gross Sales = 1500 + 1500 + 1450 + 3000 = 7450.00
    # Total Gross Revenue before discounts = 1500 + 1500 + 1550 + 3000 = 7550.00
    # Total Discounts = 100.00
    # Total Returns = 1500 + 600 + 1500 = 3600.00
    # Net Sales / Net Revenue = 7450 - 3600 = 3850.00
    # (Check: Sale1=0 + Sale2=900 + Sale3=1450 + Sale4=1500 = 3850.00)
    #
    # COGS calculation:
    # Sale 1: (10 - 10) * 100 = 0.00  (Fully returned -> COGS reversed)
    # Sale 2: (10 - 4) * 100 = 600.00 (4 units returned -> COGS adjusted)
    # Sale 3: (5 - 0) * 200 = 1000.00 (No return)
    # Sale 4: (10 - 5) * 200 = 1000.00 (5 units returned -> COGS adjusted)
    # Total COGS = 0 + 600 + 1000 + 1000 = 2600.00
    #
    # Net Profit = Net Revenue (3850.00) - COGS (2600.00) = 1250.00
    # Profit Margin = (1250 / 3850) * 100 = 32.47%

    # Assertions on Sales Report
    assert round(sales_rep.summary.TotalGrossSales, 2) == 7450.00
    assert round(sales_rep.summary.TotalReturns, 2) == 3600.00
    assert round(sales_rep.summary.NetSales, 2) == 3850.00
    assert round(sales_rep.summary.TotalCOGS, 2) == 2600.00
    assert round(sales_rep.summary.NetProfit, 2) == 1250.00
    assert round(sales_rep.summary.TotalGrossSales - sales_rep.summary.TotalReturns, 2) == round(sales_rep.summary.NetSales, 2)

    # Assertions on Financial Report
    assert round(fin_rep.summary.GrossSales, 2) == 7550.00
    assert round(fin_rep.summary.DiscountsApplied, 2) == 100.00
    assert round(fin_rep.summary.SalesReturns, 2) == 3600.00
    assert round(fin_rep.summary.TotalRevenue, 2) == 3850.00
    assert round(fin_rep.summary.TotalCOGS, 2) == 2600.00
    assert round(fin_rep.summary.GrossProfit, 2) == 1250.00
    assert round(fin_rep.summary.NetProfit, 2) == 1250.00
    assert round(fin_rep.summary.GrossSales - fin_rep.summary.DiscountsApplied - fin_rep.summary.SalesReturns, 2) == round(fin_rep.summary.TotalRevenue, 2)

    # Core Reconciliation Between Both Reports
    assert round(sales_rep.summary.NetSales, 2) == round(fin_rep.summary.TotalRevenue, 2)
    assert round(sales_rep.summary.TotalCOGS, 2) == round(fin_rep.summary.TotalCOGS, 2)
    assert round(sales_rep.summary.NetProfit, 2) == round(fin_rep.summary.NetProfit, 2)
    assert round(sales_rep.summary.TotalReturns, 2) == round(fin_rep.summary.SalesReturns, 2)
    assert round(sales_rep.summary.ProfitMarginPercent, 1) == round(fin_rep.summary.ProfitMargin, 1)

    # Verify Transactions Trail
    assert len(sales_rep.transactions) == 4
    tx_by_inv = {t.InvoiceNo: t for t in sales_rep.transactions}
    assert tx_by_inv["INV-TEST-001"].Status == "Returned"
    assert tx_by_inv["INV-TEST-001"].GrandTotal == 0.00
    assert tx_by_inv["INV-TEST-001"].Profit == 0.00

    assert tx_by_inv["INV-TEST-002"].Status == "Completed"
    assert tx_by_inv["INV-TEST-002"].GrandTotal == 900.00
    assert tx_by_inv["INV-TEST-002"].Profit == 300.00  # 900 net - 600 cogs = 300

    assert tx_by_inv["INV-TEST-003"].Status == "Completed"
    assert tx_by_inv["INV-TEST-003"].GrandTotal == 1450.00
    assert tx_by_inv["INV-TEST-003"].Profit == 450.00  # 1450 net - 1000 cogs = 450

    assert tx_by_inv["INV-TEST-004"].Status == "Pending"
    assert tx_by_inv["INV-TEST-004"].GrandTotal == 1500.00
    assert tx_by_inv["INV-TEST-004"].Profit == 500.00  # 1500 net - 1000 cogs = 500

    total_tx_profit = sum(t.Profit for t in sales_rep.transactions)
    assert round(total_tx_profit, 2) == round(sales_rep.summary.NetProfit, 2)
