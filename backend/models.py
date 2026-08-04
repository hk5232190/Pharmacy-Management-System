from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Date, CheckConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    UserId = Column(Integer, primary_key=True, autoincrement=True)
    Username = Column(String(50), unique=True, nullable=False)
    PasswordHash = Column(String(256), nullable=False)
    Salt = Column(String(128), nullable=False)
    IsActive = Column(Boolean, default=True)
    CreatedAt = Column(DateTime, server_default=func.now())

    sales = relationship("Sale", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Category(Base):
    __tablename__ = "categories"

    CategoryId = Column(Integer, primary_key=True, autoincrement=True)
    CategoryName = Column(String(50), unique=True, nullable=False)
    IsActive = Column(Boolean, default=True)

    medicines = relationship("Medicine", back_populates="category")

class Company(Base):
    __tablename__ = "companies"

    CompanyId = Column(Integer, primary_key=True, autoincrement=True)
    CompanyName = Column(String(100), unique=True, nullable=False)
    IsActive = Column(Boolean, default=True)

    medicines = relationship("Medicine", back_populates="company")

class Medicine(Base):
    __tablename__ = "medicines"

    MedicineId = Column(Integer, primary_key=True, autoincrement=True)
    BrandName = Column(String(100), nullable=False)
    GenericName = Column(String(100), nullable=False)
    CategoryId = Column(Integer, ForeignKey("categories.CategoryId"), nullable=False)
    CompanyId = Column(Integer, ForeignKey("companies.CompanyId"), nullable=False)
    RackNumber = Column(String(20), nullable=True)
    ReorderLevel = Column(Integer, default=10, nullable=False)
    RequiresPrescription = Column(Boolean, default=False)
    Unit = Column(String(50), nullable=False, default="Box")
    Barcode = Column(String(100), unique=True, nullable=True)
    DefaultCostPrice = Column(Numeric(18, 2), nullable=False, default=0)
    DefaultSellingPrice = Column(Numeric(18, 2), nullable=False, default=0)
    IsActive = Column(Boolean, default=True)

    category = relationship("Category", back_populates="medicines")
    company = relationship("Company", back_populates="medicines")
    batches = relationship("StockBatch", back_populates="medicine")
    purchase_items = relationship("PurchaseItem", back_populates="medicine")

    __table_args__ = (
        Index('IX_Medicines_BrandName', 'BrandName'),
    )

class Supplier(Base):
    __tablename__ = "suppliers"

    SupplierId = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(100), nullable=False)
    Phone = Column(String(20), nullable=False)
    TaxNumber = Column(String(50), nullable=True)
    Address = Column(Text, nullable=True)
    IsActive = Column(Boolean, default=True)

    purchases = relationship("Purchase", back_populates="supplier")

class StockBatch(Base):
    __tablename__ = "stock_batches"

    BatchId = Column(Integer, primary_key=True, autoincrement=True)
    MedicineId = Column(Integer, ForeignKey("medicines.MedicineId"), nullable=False)
    BatchCode = Column(String(50), nullable=False)
    Quantity = Column(Integer, nullable=False)
    CostPrice = Column(Numeric(18, 2), nullable=False)
    SellingPrice = Column(Numeric(18, 2), nullable=False)
    ManufacturingDate = Column(Date, nullable=True)
    ExpiryDate = Column(Date, nullable=False)
    ReceivedDate = Column(DateTime, server_default=func.now())

    medicine = relationship("Medicine", back_populates="batches")
    sales_items = relationship("SaleItem", back_populates="batch")

    __table_args__ = (
        CheckConstraint('Quantity >= 0', name='check_quantity_positive'),
        Index('IX_StockBatches_Medicine_Expiry', 'MedicineId', 'ExpiryDate', 'Quantity'),
    )

class Purchase(Base):
    __tablename__ = "purchases"

    PurchaseId = Column(Integer, primary_key=True, autoincrement=True)
    SupplierId = Column(Integer, ForeignKey("suppliers.SupplierId"), nullable=False)
    InvoiceNumber = Column(String(50), nullable=False)
    SupplierInvNo = Column(String(50), nullable=True)
    PaymentStatus = Column(String(20), nullable=False, default="Unpaid")
    PaymentMethod = Column(String(50), nullable=True)
    Notes = Column(Text, nullable=True)
    
    SubTotal = Column(Numeric(18, 2), nullable=False, default=0)
    TotalDiscount = Column(Numeric(18, 2), nullable=False, default=0)
    TotalTax = Column(Numeric(18, 2), nullable=False, default=0)
    GrandTotal = Column(Numeric(18, 2), nullable=False, default=0)
    PaidAmount = Column(Numeric(18, 2), nullable=False, default=0)
    RemainingBalance = Column(Numeric(18, 2), nullable=False, default=0)
    
    PurchaseDate = Column(DateTime, nullable=False)

    supplier = relationship("Supplier", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    PurchaseItemId = Column(Integer, primary_key=True, autoincrement=True)
    PurchaseId = Column(Integer, ForeignKey("purchases.PurchaseId"), nullable=False)
    MedicineId = Column(Integer, ForeignKey("medicines.MedicineId"), nullable=False)
    BatchCode = Column(String(50), nullable=False)
    Quantity = Column(Integer, nullable=False)
    FreeQty = Column(Integer, nullable=False, default=0)
    CostPrice = Column(Numeric(18, 2), nullable=False)
    SellingPrice = Column(Numeric(18, 2), nullable=False)
    Discount = Column(Numeric(18, 2), nullable=False, default=0)
    TaxPercentage = Column(Numeric(18, 2), nullable=False, default=0)
    LineTotal = Column(Numeric(18, 2), nullable=False)
    ManufacturingDate = Column(Date, nullable=True)
    ExpiryDate = Column(Date, nullable=False)

    purchase = relationship("Purchase", back_populates="items")
    medicine = relationship("Medicine", back_populates="purchase_items")

class Customer(Base):
    __tablename__ = "customers"

    CustomerId = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(100), nullable=False)
    Phone = Column(String(20), nullable=True)
    LoyaltyPoints = Column(Integer, default=0, nullable=False)
    IsActive = Column(Boolean, default=True)

    sales = relationship("Sale", back_populates="customer")

class Sale(Base):
    __tablename__ = "sales"

    SalesId = Column(Integer, primary_key=True, autoincrement=True)
    CustomerId = Column(Integer, ForeignKey("customers.CustomerId"), nullable=True)
    InvoiceNumber = Column(String(50), unique=True, nullable=False)
    UserId = Column(Integer, ForeignKey("users.UserId"), nullable=False)
    SubTotal = Column(Numeric(18, 2), nullable=False)
    DiscountAmount = Column(Numeric(18, 2), default=0.00, nullable=False)
    GrandTotal = Column(Numeric(18, 2), nullable=False)
    PaymentMethod = Column(String(20), nullable=False)
    TransactionDate = Column(DateTime, server_default=func.now())

    customer = relationship("Customer", back_populates="sales")
    user = relationship("User", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale")

    __table_args__ = (
        Index('IX_Sales_InvoiceNumber', 'InvoiceNumber'),
    )

class SaleItem(Base):
    __tablename__ = "sale_items"

    SalesItemId = Column(Integer, primary_key=True, autoincrement=True)
    SalesId = Column(Integer, ForeignKey("sales.SalesId"), nullable=False)
    BatchId = Column(Integer, ForeignKey("stock_batches.BatchId"), nullable=False)
    Quantity = Column(Integer, nullable=False)
    UnitPrice = Column(Numeric(18, 2), nullable=False)
    TotalPrice = Column(Numeric(18, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    batch = relationship("StockBatch", back_populates="sales_items")

    __table_args__ = (
        CheckConstraint('Quantity > 0', name='check_sale_quantity_positive'),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"

    LogId = Column(Integer, primary_key=True, autoincrement=True)
    UserId = Column(Integer, ForeignKey("users.UserId"), nullable=False)
    Action = Column(String(50), nullable=False)
    Description = Column(Text, nullable=False)
    Timestamp = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="audit_logs")

class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"

    ReturnId = Column(Integer, primary_key=True, autoincrement=True)
    PurchaseId = Column(Integer, ForeignKey("purchases.PurchaseId"), nullable=False)
    SupplierId = Column(Integer, ForeignKey("suppliers.SupplierId"), nullable=False)
    ReturnInvoiceNumber = Column(String(50), unique=True, nullable=False)
    ReturnDate = Column(DateTime, server_default=func.now())
    TotalRefundAmount = Column(Numeric(18, 2), nullable=False)
    Reason = Column(Text, nullable=True)

    items = relationship("PurchaseReturnItem", back_populates="purchase_return")

class PurchaseReturnItem(Base):
    __tablename__ = "purchase_return_items"

    ReturnItemId = Column(Integer, primary_key=True, autoincrement=True)
    ReturnId = Column(Integer, ForeignKey("purchase_returns.ReturnId"), nullable=False)
    MedicineId = Column(Integer, ForeignKey("medicines.MedicineId"), nullable=False)
    BatchCode = Column(String(50), nullable=False)
    ReturnQuantity = Column(Integer, nullable=False)
    RefundAmount = Column(Numeric(18, 2), nullable=False)

    purchase_return = relationship("PurchaseReturn", back_populates="items")
