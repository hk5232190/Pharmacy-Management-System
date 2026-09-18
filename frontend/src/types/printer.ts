export interface PrinterSettings {
  SettingsId?: number;
  PharmacyName: string;
  PharmacyAddress: string | null;
  PharmacyPhone: string | null;
  DrugLicenseNumber: string | null;
  NtnStrn: string | null;
  Website: string | null;
  ReceiptLogoPath: string | null;
  // Hardware
  PrinterType: string;
  PaperSize: string;
  CustomPaperWidthMm: number | null;
  SelectedPrinterName: string;
  ConnectionPort: string;
  CustomRawByteSequence: string;
  // Behaviour
  Copies: number;
  OpenPrintDialog: boolean;
  AutoCutPaper: boolean;
  OpenCashDrawer: boolean;
  // Layout
  ReceiptTitle: string;
  FontScale: number;
  CharactersPerLine: number;
  ItemNameWidth: number;
  ReceiptFooterMessage: string;
  // Header toggles
  ShowLogo: boolean;
  ShowPharmacyName: boolean;
  ShowAddress: boolean;
  ShowPhoneNumber: boolean;
  // Invoice info toggles
  ShowInvoiceNumber: boolean;
  ShowDate: boolean;
  ShowTime: boolean;
  ShowCashier: boolean;
  ShowCustomerName: boolean;
  // Totals toggles
  ShowSubtotal: boolean;
  ShowDiscount: boolean;
  ShowTax: boolean;
  ShowAmountPaid: boolean;
  ShowChangeDue: boolean;
  ShowPaymentMethod: boolean;
  // Item detail toggles
  PrintLicenseAndNtn: boolean;
}
