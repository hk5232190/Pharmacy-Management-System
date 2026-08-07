from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PharmacyProfileBase(BaseModel):
    PharmacyName: str
    OwnerName: Optional[str] = None
    RegistrationNumber: Optional[str] = None
    DrugLicenseNumber: Optional[str] = None
    PhoneNumber: Optional[str] = None
    EmailAddress: Optional[str] = None
    Address: Optional[str] = None
    City: Optional[str] = None
    State: Optional[str] = None
    Country: Optional[str] = None
    PostalCode: Optional[str] = None
    Website: Optional[str] = None
    LogoPath: Optional[str] = None

class PharmacyProfileCreate(PharmacyProfileBase):
    pass

class PharmacyProfileUpdate(PharmacyProfileBase):
    pass

class PharmacyProfileResponse(PharmacyProfileBase):
    ProfileId: int
    UpdatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class BillingSettingsBase(BaseModel):
    Currency: str
    CurrencySymbol: str
    TaxEnabled: bool
    DefaultTaxRate: float
    DiscountEnabled: bool
    MaxDiscountPercentage: float
    AdminDiscountThreshold: float
    RequireAdminPinForDiscount: bool
    InvoicePrefix: str
    NextInvoiceNumber: int
    DefaultPaymentMethod: str
    AutoPrintReceipt: bool
    ShowKeyboardShortcuts: bool

class BillingSettingsUpdate(BillingSettingsBase):
    pass

class BillingSettingsResponse(BillingSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True

class InventorySettingsBase(BaseModel):
    LowStockThreshold: int
    ExpiryAlertDays: int
    AllowNegativeStock: bool
    DefaultUnit: str
    AutoGenerateBarcode: bool
    PreventSaleOfExpired: bool = True

class InventorySettingsUpdate(InventorySettingsBase):
    pass

class InventorySettingsResponse(InventorySettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True

class PrinterSettingsBase(BaseModel):
    PrinterType: str
    PaperSize: str
    SelectedPrinterName: Optional[str] = None
    ConnectionPort: str
    CustomRawByteSequence: Optional[str] = None
    ShowLogo: bool
    ShowPharmacyName: bool
    ShowAddress: bool
    ReceiptFooterMessage: Optional[str] = None

class PrinterSettingsUpdate(PrinterSettingsBase):
    pass

class PrinterSettingsResponse(PrinterSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True
