from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Date, CheckConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    UserId = Column(Integer, primary_key=True, autoincrement=True)
    Username = Column(String(50), unique=True, nullable=False)
    Email = Column(String(100), nullable=True)
    PasswordHash = Column(String(256), nullable=False)
    Salt = Column(String(128), nullable=False)
    FullName = Column(String(100), nullable=True)
    PhoneNumber = Column(String(20), nullable=True)
    ProfilePhotoPath = Column(String(255), nullable=True)
    IsActive = Column(Boolean, default=True)
    CreatedAt = Column(DateTime, server_default=func.now())

    sales = relationship("Sale", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Category(Base):
    __tablename__ = "categories"

    CategoryId = Column(Integer, primary_key=True, autoincrement=True)
    CategoryName = Column(String(100), unique=True, index=True, nullable=False)
    Description = Column(String(255), nullable=True)
    IsActive = Column(Boolean, default=True)

    medicines = relationship("Medicine", back_populates="category")

class Company(Base):
    __tablename__ = "companies"

    CompanyId = Column(Integer, primary_key=True, autoincrement=True)
    CompanyName = Column(String(100), unique=True, index=True, nullable=False)
    ContactPerson = Column(String(100), nullable=True)
    Phone = Column(String(50), nullable=True)
    Address = Column(String(255), nullable=True)
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
    DosageForm = Column(String(50), nullable=True)
    Strength = Column(String(50), nullable=True)
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
    TaxNumber = Column(String(100), nullable=True)
    Address = Column(Text, nullable=True)
    ContactPerson = Column(String(100), nullable=True)
    CurrentBalance = Column(Numeric(10, 2), default=0.0)
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
    Address = Column(Text, nullable=True)
    LoyaltyPoints = Column(Integer, default=0, nullable=False)
    DueBalance = Column(Numeric(10, 2), default=0.0)
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
    TaxAmount = Column(Numeric(18, 2), default=0.00, nullable=False)
    GrandTotal = Column(Numeric(18, 2), nullable=False)
    PaidAmount = Column(Numeric(18, 2), default=0.00, nullable=False)
    PaymentMethod = Column(String(20), nullable=False)
    Status = Column(String(50), default="Completed")
    PrescriptionRef = Column(String(100), nullable=True)
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
    Discount = Column(Numeric(18, 2), default=0.00)
    Tax = Column(Numeric(18, 2), default=0.00)
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
    SettlementType = Column(String(50), nullable=True, default="Adjust in Supplier Balance")

    items = relationship("PurchaseReturnItem", back_populates="purchase_return")

class PurchaseReturnItem(Base):
    __tablename__ = "purchase_return_items"

    ReturnItemId = Column(Integer, primary_key=True, autoincrement=True)
    ReturnId = Column(Integer, ForeignKey("purchase_returns.ReturnId"), nullable=False)
    MedicineId = Column(Integer, ForeignKey("medicines.MedicineId"), nullable=False)
    BatchCode = Column(String(50), nullable=False)
    ReturnQuantity = Column(Integer, nullable=False)
    RefundAmount = Column(Numeric(18, 2), nullable=False)
    ReturnReason = Column(String(100), nullable=True)

    purchase_return = relationship("PurchaseReturn", back_populates="items")

class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    AdjustmentId = Column(Integer, primary_key=True, autoincrement=True)
    BatchId = Column(Integer, ForeignKey("stock_batches.BatchId"), nullable=False)
    UserId = Column(Integer, ForeignKey("users.UserId"), nullable=False)
    AdjustmentType = Column(String(20), nullable=False) # 'Increase' or 'Decrease'
    Quantity = Column(Integer, nullable=False)
    PreviousQuantity = Column(Integer, nullable=True)
    NewQuantity = Column(Integer, nullable=True)
    Reason = Column(Text, nullable=False)
    AdjustmentDate = Column(DateTime, server_default=func.now())

    batch = relationship("StockBatch")
    user = relationship("User")

    __table_args__ = (
        CheckConstraint("AdjustmentType IN ('Increase', 'Decrease')", name='check_adjustment_type'),
        CheckConstraint("Quantity > 0", name='check_adjustment_qty_positive'),
    )

class SaleReturn(Base):
    __tablename__ = "sale_returns"

    ReturnId = Column(Integer, primary_key=True, autoincrement=True)
    SalesId = Column(Integer, ForeignKey("sales.SalesId"), nullable=False)
    UserId = Column(Integer, ForeignKey("users.UserId"), nullable=False)
    ReturnInvoiceNumber = Column(String(50), unique=True, nullable=False)
    TotalRefundAmount = Column(Numeric(18, 2), nullable=False)
    RefundMode = Column(String(30), default="Cash Refund", nullable=False)
    Reason = Column(Text, nullable=False)
    ReturnDate = Column(DateTime, server_default=func.now())

    sale = relationship("Sale")
    user = relationship("User")
    items = relationship("SaleReturnItem", back_populates="sale_return")

class SaleReturnItem(Base):
    __tablename__ = "sale_return_items"

    ReturnItemId = Column(Integer, primary_key=True, autoincrement=True)
    ReturnId = Column(Integer, ForeignKey("sale_returns.ReturnId"), nullable=False)
    BatchId = Column(Integer, ForeignKey("stock_batches.BatchId"), nullable=False)
    ReturnQuantity = Column(Integer, nullable=False)
    RefundAmount = Column(Numeric(18, 2), nullable=False)
    ItemCondition = Column(String(50), nullable=False) # 'Restockable' or 'Damaged/Quarantine'
    ReturnReason = Column(String(100), nullable=True)

    sale_return = relationship("SaleReturn", back_populates="items")
    batch = relationship("StockBatch")

    __table_args__ = (
        CheckConstraint("ItemCondition IN ('Restockable', 'Damaged/Quarantine')", name='check_sale_return_condition'),
        CheckConstraint('ReturnQuantity > 0', name='check_sale_return_qty_positive'),
    )

class BackupHistory(Base):
    __tablename__ = "backup_history"

    BackupId = Column(Integer, primary_key=True, autoincrement=True)
    BackupName = Column(String(255), nullable=False)
    BackupLocation = Column(String(500), nullable=False)
    SizeBytes = Column(Integer, nullable=False)
    BackupType = Column(String(50), nullable=False) # 'Manual' or 'Automatic'
    Status = Column(String(50), nullable=False) # 'Success', 'Failed'
    ChecksumSHA256 = Column(String(64), nullable=True)
    CreatedAt = Column(DateTime, server_default=func.now())

class BackupSettings(Base):
    __tablename__ = "backup_settings"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    IsAutoBackupEnabled = Column(Boolean, default=False)
    BackupFrequency = Column(String(50), default="Daily") # Daily, Weekly, Monthly
    BackupTime = Column(String(10), default="23:00")
    BackupLocation = Column(String(500), default="./backups/automatic")
    RetentionCount = Column(Integer, default=7)
    BackupOnStartup = Column(Boolean, default=False)
    CompressBackup = Column(Boolean, default=True)
    AutoVerify = Column(Boolean, default=False)

class PharmacyProfile(Base):
    __tablename__ = "pharmacy_profile"

    ProfileId = Column(Integer, primary_key=True, autoincrement=True)
    PharmacyName = Column(String(255), nullable=False, default="My Pharmacy")
    OwnerName = Column(String(255), nullable=True)
    PharmacySlogan = Column(String(255), nullable=True)
    RegistrationNumber = Column(String(100), nullable=True)
    DrugLicenseNumber = Column(String(100), nullable=True)
    NtnStrn = Column(String(100), nullable=True)
    PhoneNumber = Column(String(50), nullable=True)
    EmailAddress = Column(String(255), nullable=True)
    Address = Column(String(500), nullable=True)
    City = Column(String(100), nullable=True)
    State = Column(String(100), nullable=True)
    Country = Column(String(100), nullable=True)
    PostalCode = Column(String(20), nullable=True)
    Website = Column(String(255), nullable=True)
    LogoPath = Column(String(500), nullable=True)
    ReceiptLogoPath = Column(String(500), nullable=True)
    UpdatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

class BillingSettings(Base):
    __tablename__ = "billing_settings"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    Currency = Column(String(10), nullable=False, default="PKR")
    CurrencySymbol = Column(String(5), nullable=False, default="Rs")
    TaxEnabled = Column(Boolean, default=False, nullable=False)
    DefaultTaxRate = Column(Numeric(5, 2), default=0.00, nullable=False)
    DiscountEnabled = Column(Boolean, default=True, nullable=False)
    MaxDiscountPercentage = Column(Numeric(5, 2), default=100.00, nullable=False)
    AdminDiscountThreshold = Column(Numeric(5, 2), default=10.00, nullable=False)
    RequireAdminPinForDiscount = Column(Boolean, default=True, nullable=False)
    InvoicePrefix = Column(String(20), nullable=False, default="INV-")
    NextInvoiceNumber = Column(Integer, nullable=False, default=1)
    DefaultPaymentMethod = Column(String(50), nullable=False, default="Cash")
    AutoPrintReceipt = Column(Boolean, default=True, nullable=False)
    ShowKeyboardShortcuts = Column(Boolean, default=True, nullable=False)

class InventorySettings(Base):
    __tablename__ = "inventory_settings"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    LowStockThreshold = Column(Integer, nullable=False, default=10)
    ExpiryAlertDays = Column(Integer, nullable=False, default=90)
    AllowNegativeStock = Column(Boolean, default=False, nullable=False)
    DefaultUnit = Column(String(50), nullable=False, default="Box")
    AutoGenerateBarcode = Column(Boolean, default=True, nullable=False)
    PreventSaleOfExpired = Column(Boolean, default=True, nullable=False)
    EnableFefo = Column(Boolean, default=True, nullable=False)
    DefaultProfitMargin = Column(Numeric(5, 2), default=0.00, nullable=False)

class PrinterSettings(Base):
    __tablename__ = "printer_settings"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    PrinterType = Column(String(50), nullable=False, default="ESC/POS Thermal")
    PaperSize = Column(String(50), nullable=False, default="80mm")
    SelectedPrinterName = Column(String(255), nullable=True, default="")
    ConnectionPort = Column(String(50), nullable=False, default="USB")
    CustomRawByteSequence = Column(Text, nullable=True, default="\\x1B\\x70\\x00\\x19\\xFA") # Standard cash drawer kick
    ShowLogo = Column(Boolean, default=True, nullable=False)
    ShowPharmacyName = Column(Boolean, default=True, nullable=False)
    ShowAddress = Column(Boolean, default=True, nullable=False)
    ReceiptFooterMessage = Column(Text, nullable=True, default="Thank you for your visit! Wishing you good health.")
    AutoCutPaper = Column(Boolean, default=True, nullable=False)
    OpenCashDrawer = Column(Boolean, default=True, nullable=False)
    PrintBatchAndExpiry = Column(Boolean, default=True, nullable=False)
    PrintLicenseAndNtn = Column(Boolean, default=False, nullable=False)
    PrintDoctorAndPatient = Column(Boolean, default=False, nullable=False)

class SystemPreferences(Base):
    __tablename__ = "system_preferences"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    Theme = Column(String(50), nullable=False, default="System Default")
    DateFormat = Column(String(50), nullable=False, default="DD/MM/YYYY")
    TimeFormat = Column(String(50), nullable=False, default="12h")
    NumberFormat = Column(String(50), nullable=False, default="1,234.56")
    StartupModule = Column(String(50), nullable=False, default="Dashboard")
    EnableAudioAlerts = Column(Boolean, default=True, nullable=False)
    EnableToastNotifications = Column(Boolean, default=True, nullable=False)
    Language = Column(String(50), nullable=False, default="English")
    AlertVolume = Column(Integer, default=50, nullable=False)
    AlertTriggerSale = Column(Boolean, default=True, nullable=False)
    AlertTriggerLowStock = Column(Boolean, default=True, nullable=False)
    AlertTriggerNearExpiry = Column(Boolean, default=True, nullable=False)
    AlertTriggerErrors = Column(Boolean, default=True, nullable=False)

class SecuritySettings(Base):
    __tablename__ = "security_settings"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    AutoLockEnabled = Column(Boolean, default=False, nullable=False)
    AutoLockMinutes = Column(Integer, default=15, nullable=False)
    SessionTimeoutEnabled = Column(Boolean, default=True, nullable=False)
    SessionTimeoutMinutes = Column(Integer, default=120, nullable=False)
    UpdatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

class GeneralSettings(Base):
    __tablename__ = "general_settings"

    SettingsId = Column(Integer, primary_key=True, autoincrement=True)
    LoginBrandingName = Column(String(255), nullable=False, default="PMS Software")
    LoginSubheading = Column(String(255), nullable=False, default="Pharmacy Management System")
    LoginBackgroundPath = Column(String(500), nullable=True)
