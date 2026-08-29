from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PharmacyProfileBase(BaseModel):
    PharmacyName: str
    OwnerName: Optional[str] = None
    RegistrationNumber: Optional[str] = None
    DrugLicenseNumber: Optional[str] = None
    PhoneNumber: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
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

class SystemPreferencesBase(BaseModel):
    Theme: str
    DateFormat: str
    TimeFormat: str
    NumberFormat: str
    StartupModule: str
    EnableAudioAlerts: bool
    EnableToastNotifications: bool
    Language: str

class SystemPreferencesUpdate(SystemPreferencesBase):
    pass

class SystemPreferencesResponse(SystemPreferencesBase):
    SettingsId: int

    class Config:
        from_attributes = True

class GeneralSettingsBase(BaseModel):
    LoginBrandingName: str = "PMS Software"
    LoginSubheading: str = "Pharmacy Management System"
    LoginBackgroundPath: Optional[str] = None

class GeneralSettingsUpdate(GeneralSettingsBase):
    pass

class GeneralSettingsResponse(GeneralSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True
