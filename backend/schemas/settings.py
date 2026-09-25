from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BillingSettingsBase(BaseModel):
    Currency: str
    CurrencySymbol: str
    TaxEnabled: bool
    DefaultTaxRate: float
    DiscountEnabled: bool
    DefaultDiscountRate: float = 0.00
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
    # Pharmacy Branding
    PharmacyName: str = "My Pharmacy"
    PharmacyAddress: Optional[str] = None
    PharmacyPhone: Optional[str] = None
    DrugLicenseNumber: Optional[str] = None
    NtnStrn: Optional[str] = None
    Website: Optional[str] = None
    ReceiptLogoPath: Optional[str] = None
    
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
    PrintLicenseAndNtn: bool = False

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
    LoginSubheading: str = "Please sign in to continue"
    LoginBackgroundPath: Optional[str] = None

class GeneralSettingsUpdate(GeneralSettingsBase):
    pass

class GeneralSettingsResponse(GeneralSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True
