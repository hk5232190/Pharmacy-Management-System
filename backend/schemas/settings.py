from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PharmacyProfileBase(BaseModel):
    PharmacyName: str
    OwnerName: Optional[str] = None
    PharmacySlogan: Optional[str] = None
    RegistrationNumber: Optional[str] = None
    DrugLicenseNumber: Optional[str] = None
    NtnStrn: Optional[str] = None
    PhoneNumber: Optional[str] = Field(None, pattern=r'^(?:(?:\+92|0)[-\s]?\d{2,4}[-\s]?\d{6,8})?$')
    EmailAddress: Optional[str] = None
    Address: Optional[str] = None
    City: Optional[str] = None
    State: Optional[str] = None
    Country: Optional[str] = None
    PostalCode: Optional[str] = None
    Website: Optional[str] = None
    LogoPath: Optional[str] = None
    ReceiptLogoPath: Optional[str] = None
    ReceiptFooter1: Optional[str] = None
    ReceiptFooter2: Optional[str] = None

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
    EnableFefo: bool = True
    DefaultProfitMargin: float = 0.00

class InventorySettingsUpdate(InventorySettingsBase):
    pass

class InventorySettingsResponse(InventorySettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True

class PrinterSettingsBase(BaseModel):
    # Hardware
    PrinterType: str = "ESC/POS Thermal"
    PaperSize: str = "80mm"
    CustomPaperWidthMm: Optional[int] = None
    SelectedPrinterName: Optional[str] = None
    ConnectionPort: str = "USB"
    CustomRawByteSequence: Optional[str] = None
    # Printer behaviour
    Copies: int = 1
    OpenPrintDialog: bool = False
    AutoCutPaper: bool = True
    OpenCashDrawer: bool = True
    # Receipt layout
    ReceiptTitle: Optional[str] = "SALE RECEIPT"
    FontScale: int = 100
    CharactersPerLine: int = 42
    ItemNameWidth: int = 16
    ReceiptFooterMessage: Optional[str] = None
    # Header toggles
    ShowLogo: bool = True
    ShowPharmacyName: bool = True
    ShowAddress: bool = True
    ShowPhoneNumber: bool = True
    # Invoice info toggles
    ShowInvoiceNumber: bool = True
    ShowDate: bool = True
    ShowTime: bool = True
    ShowCashier: bool = True
    ShowCustomerName: bool = True
    # Totals toggles
    ShowSubtotal: bool = True
    ShowDiscount: bool = True
    ShowTax: bool = True
    ShowAmountPaid: bool = True
    ShowChangeDue: bool = True
    ShowPaymentMethod: bool = True
    # Item detail toggles
    PrintBatchAndExpiry: bool = True
    PrintLicenseAndNtn: bool = False
    PrintDoctorAndPatient: bool = False

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
    EnableAudioAlerts: Optional[bool] = True
    EnableToastNotifications: Optional[bool] = True
    Language: Optional[str] = "English"
    AlertVolume: Optional[int] = 50
    AlertTriggerSale: Optional[bool] = True
    AlertTriggerLowStock: Optional[bool] = True
    AlertTriggerNearExpiry: Optional[bool] = True
    AlertTriggerErrors: Optional[bool] = True

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
