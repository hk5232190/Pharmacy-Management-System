import { getApiBaseUrl } from "@/lib/api-client";
import { PrinterSettings } from "@/types/printer";

export interface ReceiptItemProps {
  name: string;
  qty: number;
  price: number;
  total: number;
  batch?: string;
  exp?: string;
}

export interface ReceiptPreviewProps {
  settings: PrinterSettings;
  currency: string;
  
  // Overrides for actual sales
  isReprint?: boolean;
  invoiceNumber?: string;
  date?: string;
  time?: string;
  customerName?: string;
  cashierName?: string;
  paymentMethod?: string;
  items?: ReceiptItemProps[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  grandTotal?: number;
  paidAmount?: number;
  changeDue?: number;
}

export function ReceiptPreview({
  settings,
  currency,
  isReprint = false,
  invoiceNumber = "INV-2609-0042",
  date = "16-Sep-2026",
  time = "02:05 PM",
  customerName = "John Smith",
  cashierName = "Admin",
  paymentMethod = "Cash",
  items = [
    { name: "Panadol Extra 500mg", qty: 2, price: 50, total: 100, batch: "B123", exp: "12/26" },
    { name: "Amoxil Syrup 250ml", qty: 1, price: 250, total: 250, batch: "A456", exp: "05/27" },
    { name: "Disprin 100mg (10 Tabs)", qty: 3, price: 30, total: 90, batch: "D789", exp: "03/26" },
  ],
  subtotal = 440,
  discount = 0,
  tax = 0,
  grandTotal = 440,
  paidAmount = 500,
  changeDue = 60,
}: ReceiptPreviewProps) {
  const paperWidthClass = settings.PaperSize === "58mm" ? "w-44" : "w-64";
  const fontSize = `${Math.round(10 * settings.FontScale / 100)}px`;
  const nameTruncate = settings.ItemNameWidth;

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max - 1) + "~" : text;

  // Add dashed border helper
  const DottedLine = () => <div className="border-t border-dashed border-slate-400 my-1" />;

  const logoUrl = settings.ReceiptLogoPath
    ? `${getApiBaseUrl().replace("/api/v1", "")}${settings.ReceiptLogoPath.startsWith('/') ? settings.ReceiptLogoPath : '/' + settings.ReceiptLogoPath}`
    : null;
    
  const licenseInfo = [
    settings.DrugLicenseNumber ? `Lic: ${settings.DrugLicenseNumber}` : null,
    settings.NtnStrn ? `NTN: ${settings.NtnStrn}` : null
  ].filter(Boolean).join(" / ");

  return (
    <div
      id="print-area"
      className={`mx-auto bg-white border border-slate-300 shadow-lg font-mono text-black ${paperWidthClass} transition-all duration-300 relative overflow-hidden rounded-sm`}
      style={{ fontSize }}
    >
      {/* Cut marks */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

      {isReprint && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 overflow-hidden z-0">
          <span className="text-4xl font-bold transform -rotate-45 whitespace-nowrap text-black">DUPLICATE / REPRINT</span>
        </div>
      )}

      <div className="p-2.5 space-y-1 relative z-10">
        {/* Header */}
        <div className="text-center space-y-0.5">
          {settings.ShowLogo && (
            <div className="flex justify-center mb-1">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain grayscale" />
              ) : (
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-[8px] text-slate-400 font-bold">
                  LOGO
                </div>
              )}
            </div>
          )}
          {settings.ShowPharmacyName && (
            <div className="font-extrabold uppercase tracking-tight" style={{ fontSize: `${Math.round(12 * settings.FontScale / 100)}px` }}>
              {settings.PharmacyName || "PHARMACY NAME"}
            </div>
          )}
          <div className="font-bold uppercase tracking-wider">{settings.ReceiptTitle || "SALE RECEIPT"}</div>
          
          {isReprint && (
            <div className="text-center font-bold text-[10px] my-1 border-y border-black py-0.5">
              *** DUPLICATE / REPRINT ***
            </div>
          )}

          {settings.ShowAddress && settings.PharmacyAddress && (
            <div className="text-slate-600 leading-tight">{settings.PharmacyAddress}</div>
          )}
          {settings.ShowPhoneNumber && settings.PharmacyPhone && (
            <div className="text-slate-600">Tel: {settings.PharmacyPhone}</div>
          )}
          {settings.PrintLicenseAndNtn && licenseInfo && (
            <div className="text-slate-500 text-[9px] uppercase">{licenseInfo}</div>
          )}
        </div>

        <DottedLine />

        {/* Invoice info */}
        <div className="space-y-0.5 text-slate-700">
          {settings.ShowInvoiceNumber && <div>Invoice : {invoiceNumber}</div>}
          {settings.ShowDate && <div>Date    : {date}</div>}
          {settings.ShowTime && <div>Time    : {time}</div>}
          {settings.ShowCustomerName && <div>Customer: {customerName}</div>}
          {settings.ShowCashier && <div>Cashier : {cashierName}</div>}
          {settings.ShowPaymentMethod && <div>Payment : {paymentMethod}</div>}
        </div>

        <DottedLine />

        {/* Items table */}
        <div className="font-semibold flex w-full">
          <span className="flex-1">Item</span>
          <span className="w-8 text-right">Qty</span>
          <span className="w-14 text-right">Price</span>
          <span className="w-16 text-right">Total</span>
        </div>
        <DottedLine />

        {items.map((item, i) => (
          <div key={i} className="mb-0.5">
            <div className="flex w-full items-start">
              <span className="flex-1 pr-1 truncate" style={{ maxWidth: `${nameTruncate}ch` }}>
                {truncate(item.name, nameTruncate)}
              </span>
              <span className="w-8 text-right shrink-0">{item.qty}</span>
              <span className="w-14 text-right shrink-0">{item.price}</span>
              <span className="w-16 text-right shrink-0">{item.total}</span>
            </div>

          </div>
        ))}

        <DottedLine />

        {/* Totals */}
        <div className="space-y-0.5 text-slate-700">
          {settings.ShowSubtotal && <div className="flex justify-between"><span>Subtotal:</span><span>{currency} {subtotal}</span></div>}
          {settings.ShowDiscount && <div className="flex justify-between"><span>Discount:</span><span>-{currency} {discount}</span></div>}
          {settings.ShowTax && <div className="flex justify-between"><span>Tax:</span><span>{currency} {tax}</span></div>}
        </div>
        
        <DottedLine />
        
        <div className="flex justify-between font-extrabold" style={{ fontSize: `${Math.round(12 * settings.FontScale / 100)}px` }}>
          <span>TOTAL:</span><span>{currency} {grandTotal}</span>
        </div>
        
        <DottedLine />
        
        {settings.ShowAmountPaid && <div className="flex justify-between text-slate-700"><span>Paid:</span><span>{currency} {paidAmount}</span></div>}
        {settings.ShowChangeDue && <div className="flex justify-between text-slate-700"><span>Change:</span><span>{currency} {changeDue}</span></div>}

        {/* Footer */}
        {settings.ReceiptFooterMessage && (
          <>
            <DottedLine />
            <div className="text-center text-slate-600 italic whitespace-pre-wrap">
              {settings.ReceiptFooterMessage}
            </div>
          </>
        )}

        {/* Feed space */}
        <div className="h-3" />
      </div>

      {/* Perforated bottom */}
      <div className="w-full h-[3px] border-t-2 border-dashed border-slate-300" />
    </div>
  );
}
