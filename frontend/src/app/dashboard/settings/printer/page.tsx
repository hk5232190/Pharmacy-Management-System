"use client";
import { getApiBaseUrl } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Save, RefreshCw, Printer, Usb, Receipt, AlertTriangle,
  CheckCircle2, Server, Settings2, Eye, Copy, Zap
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SaveButton } from "@/components/ui/save-button";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PrinterSettings {
  SettingsId?: number;
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
  PrintBatchAndExpiry: boolean;
  PrintLicenseAndNtn: boolean;
  PrintDoctorAndPatient: boolean;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  PrinterType: "ESC/POS Thermal",
  PaperSize: "80mm",
  CustomPaperWidthMm: null,
  SelectedPrinterName: "",
  ConnectionPort: "USB",
  CustomRawByteSequence: "\\x1B\\x70\\x00\\x19\\xFA",
  Copies: 1,
  OpenPrintDialog: false,
  AutoCutPaper: true,
  OpenCashDrawer: true,
  ReceiptTitle: "SALE RECEIPT",
  FontScale: 100,
  CharactersPerLine: 42,
  ItemNameWidth: 16,
  ReceiptFooterMessage: "Thank you for your visit! Wishing you good health.",
  ShowLogo: true,
  ShowPharmacyName: true,
  ShowAddress: true,
  ShowPhoneNumber: true,
  ShowInvoiceNumber: true,
  ShowDate: true,
  ShowTime: true,
  ShowCashier: true,
  ShowCustomerName: true,
  ShowSubtotal: true,
  ShowDiscount: true,
  ShowTax: true,
  ShowAmountPaid: true,
  ShowChangeDue: true,
  ShowPaymentMethod: true,
  PrintBatchAndExpiry: true,
  PrintLicenseAndNtn: false,
  PrintDoctorAndPatient: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Toggle row component
// ─────────────────────────────────────────────────────────────────────────────
function ToggleRow({
  label, description, checked, onChange,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
      <div className="space-y-0.5">
        <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</Label>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live receipt preview
// ─────────────────────────────────────────────────────────────────────────────
function ReceiptPreview({ settings, pharmacyName, pharmacyAddress, pharmacyPhone, currency, licenseInfo }: {
  settings: PrinterSettings;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  currency: string;
  licenseInfo: string;
}) {
  const paperWidthClass = settings.PaperSize === "58mm" ? "w-44" : "w-64";
  const fontSize = `${Math.round(10 * settings.FontScale / 100)}px`;
  const nameTruncate = settings.ItemNameWidth;

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max - 1) + "~" : text;

  const sep = "-".repeat(settings.CharactersPerLine);

  const items = [
    { name: "Panadol Extra 500mg", qty: 2, price: 50, total: 100, batch: "B123", exp: "12/26" },
    { name: "Amoxil Syrup 250ml", qty: 1, price: 250, total: 250, batch: "A456", exp: "05/27" },
    { name: "Disprin 100mg (10 Tabs)", qty: 3, price: 30, total: 90, batch: "D789", exp: "03/26" },
  ];

  return (
    <div
      className={`mx-auto bg-white border border-slate-300 shadow-lg font-mono text-black ${paperWidthClass} transition-all duration-300 relative overflow-hidden rounded-sm`}
      style={{ fontSize }}
    >
      {/* Cut marks */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

      <div className="p-2.5 space-y-1">
        {/* Header */}
        <div className="text-center space-y-0.5">
          {settings.ShowLogo && (
            <div className="flex justify-center mb-1">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-[8px] text-slate-400 font-bold">
                LOGO
              </div>
            </div>
          )}
          {settings.ShowPharmacyName && (
            <div className="font-extrabold uppercase tracking-tight" style={{ fontSize: `${Math.round(12 * settings.FontScale / 100)}px` }}>
              {pharmacyName}
            </div>
          )}
          <div className="font-bold uppercase tracking-wider">{settings.ReceiptTitle || "SALE RECEIPT"}</div>
          {settings.ShowAddress && pharmacyAddress && (
            <div className="text-slate-600 leading-tight">{pharmacyAddress}</div>
          )}
          {settings.ShowPhoneNumber && pharmacyPhone && (
            <div className="text-slate-600">Tel: {pharmacyPhone}</div>
          )}
          {settings.PrintLicenseAndNtn && licenseInfo && (
            <div className="text-slate-500 text-[9px] uppercase">{licenseInfo}</div>
          )}
        </div>

        <div className="border-t border-dashed border-slate-400 my-1" />

        {/* Invoice info */}
        <div className="space-y-0.5 text-slate-700">
          {settings.ShowInvoiceNumber && <div>Invoice : INV-2609-0042</div>}
          {settings.ShowDate && <div>Date    : 16-Sep-2026</div>}
          {settings.ShowTime && <div>Time    : 02:05 PM</div>}
          {settings.ShowCustomerName && <div>Customer: John Smith</div>}
          {settings.ShowCashier && <div>Cashier : Admin</div>}
          {settings.ShowPaymentMethod && <div>Payment : Cash</div>}
        </div>

        <div className="border-t border-dashed border-slate-400 my-1" />

        {/* Items table */}
        <div className="font-semibold flex justify-between">
          <span>{"Item".padEnd(nameTruncate)}</span>
          <span>Qty  Price  Total</span>
        </div>
        <div className="border-t border-dashed border-slate-400" />

        {items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between">
              <span className="truncate" style={{ maxWidth: `${nameTruncate}ch` }}>
                {truncate(item.name, nameTruncate)}
              </span>
              <span className="whitespace-nowrap ml-1">
                {String(item.qty).padStart(2)} {String(item.price).padStart(5)} {String(item.total).padStart(6)}
              </span>
            </div>
            {settings.PrintBatchAndExpiry && (
              <div className="text-slate-500" style={{ fontSize: "0.75em" }}>
                Batch:{item.batch} Exp:{item.exp}
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-dashed border-slate-400 my-1" />

        {/* Totals */}
        <div className="space-y-0.5 text-slate-700">
          {settings.ShowSubtotal && <div className="flex justify-between"><span>Subtotal:</span><span>{currency} 440</span></div>}
          {settings.ShowDiscount && <div className="flex justify-between"><span>Discount:</span><span>-{currency} 0</span></div>}
          {settings.ShowTax && <div className="flex justify-between"><span>Tax:</span><span>{currency} 0</span></div>}
        </div>
        <div className="border-t border-dashed border-slate-400" />
        <div className="flex justify-between font-extrabold" style={{ fontSize: `${Math.round(12 * settings.FontScale / 100)}px` }}>
          <span>TOTAL:</span><span>{currency} 440</span>
        </div>
        <div className="border-t border-dashed border-slate-400" />
        {settings.ShowAmountPaid && <div className="flex justify-between text-slate-700"><span>Paid:</span><span>{currency} 500</span></div>}
        {settings.ShowChangeDue && <div className="flex justify-between text-slate-700"><span>Change:</span><span>{currency} 60</span></div>}

        {/* Footer */}
        {settings.ReceiptFooterMessage && (
          <>
            <div className="border-t border-dashed border-slate-400 my-1" />
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PrinterSettingsPage() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [osPrinters, setOsPrinters] = useState<string[]>([]);
  const [printerWarning, setPrinterWarning] = useState<string | null>(null);

  // Pharmacy data for preview
  const [pharmacyName, setPharmacyName] = useState("City Pharmacy");
  const [pharmacyAddress, setPharmacyAddress] = useState("123 Health Street, Lahore");
  const [pharmacyPhone, setPharmacyPhone] = useState("+92 300 1234567");
  const [currency, setCurrency] = useState("Rs");
  const [licenseInfo, setLicenseInfo] = useState("Lic: DL-12345 / NTN: 9876543-2");

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingDrawer, setIsTestingDrawer] = useState(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Auto chars-per-line when paper size changes ──────────────────────────
  useEffect(() => {
    if (settings.PaperSize === "58mm") {
      setSetting("CharactersPerLine", 32);
      setSetting("ItemNameWidth", 12);
    } else if (settings.PaperSize === "80mm") {
      setSetting("CharactersPerLine", 42);
      setSetting("ItemNameWidth", 16);
    }
  }, [settings.PaperSize]);

  // ── Load settings and OS printers ────────────────────────────────────────
  useEffect(() => {
    fetchSettings();
    fetchOsPrinters();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const [printerRes, profileRes, billingRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/settings/printer`),
        fetch(`${getApiBaseUrl()}/settings/pharmacy-profile`),
        fetch(`${getApiBaseUrl()}/settings/billing`),
      ]);

      if (printerRes.ok) {
        const data = await printerRes.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        if (p.PharmacyName) setPharmacyName(p.PharmacyName);
        if (p.Address) setPharmacyAddress(p.Address);
        if (p.PhoneNumber) setPharmacyPhone(p.PhoneNumber);
        if (p.DrugLicenseNumber || p.NtnStrn) {
          setLicenseInfo(`Lic: ${p.DrugLicenseNumber || "N/A"} / NTN: ${p.NtnStrn || "N/A"}`);
        }
      }
      if (billingRes.ok) {
        const b = await billingRes.json();
        if (b.CurrencySymbol) setCurrency(b.CurrencySymbol);
      }
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOsPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/settings/printer/list`);
      if (res.ok) {
        const data = await res.json();
        const list: string[] = data.data || [];
        setOsPrinters(list);

        // Warn if selected printer is no longer available
        if (settings.SelectedPrinterName && list.length > 0 && !list.includes(settings.SelectedPrinterName)) {
          setPrinterWarning(`"${settings.SelectedPrinterName}" is not available. Please select another printer.`);
        } else {
          setPrinterWarning(null);
        }
      }
    } catch {
      console.error("Failed to enumerate OS printers");
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const setSetting = <K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (settings.Copies < 1 || settings.Copies > 10) {
      toast.error("Copies must be between 1 and 10.");
      return;
    }
    if (settings.FontScale < 60 || settings.FontScale > 150) {
      toast.error("Font Scale must be between 60% and 150%.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch(`${getApiBaseUrl()}/settings/printer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Printer & Receipt settings saved!");
      } else {
        toast.error("Failed to save settings.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch(`${getApiBaseUrl()}/settings/printer/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) toast.success(data.message || "Test print sent!");
      else toast.error(data.detail || "Test print failed.");
    } catch {
      toast.error("Network error during test print.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestDrawer = async () => {
    setIsTestingDrawer(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch(`${getApiBaseUrl()}/settings/printer/test-drawer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) toast.success(data.message || "Drawer kick sent!");
      else toast.error(data.detail || "Drawer test failed.");
    } catch {
      toast.error("Network error during drawer test.");
    } finally {
      setIsTestingDrawer(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const cardClass = "border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 rounded-2xl";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 pb-20 items-start pr-2 lg:pr-4">

      {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <Tabs defaultValue="hardware" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4 rounded-2xl h-11 bg-slate-100 dark:bg-slate-800/60">
            <TabsTrigger value="hardware" className="rounded-xl font-semibold flex gap-2 items-center">
              <Server className="w-4 h-4" /> Printers &amp; Copies
            </TabsTrigger>
            <TabsTrigger value="design" className="rounded-xl font-semibold flex gap-2 items-center">
              <Receipt className="w-4 h-4" /> Receipt Design
            </TabsTrigger>
          </TabsList>

          {/* ──────── TAB 1: PRINTERS & COPIES ──────── */}
          <TabsContent value="hardware" className="space-y-6">

            {/* Printer warning banner */}
            {printerWarning && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">{printerWarning}</p>
              </div>
            )}

            {/* Printer Selection */}
            <Card className={cardClass}>
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-blue-700 dark:text-blue-500">
                  <Server className="w-5 h-5" /> Printer Destination
                </CardTitle>
                <CardDescription>Select and configure the printer for receipts.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Printer list */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">System Printer</Label>
                    <div className="flex gap-2">
                      <Select
                        value={settings.SelectedPrinterName}
                        onValueChange={v => { setSetting("SelectedPrinterName", v); setPrinterWarning(null); }}
                      >
                        <SelectTrigger className="flex-1 rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus:ring-blue-500/30">
                          <SelectValue placeholder="Select printer…" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="__default__">Default System Printer</SelectItem>
                          <SelectItem value="__dialog__">Open Print Window / Dialog</SelectItem>
                          {osPrinters.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                          {osPrinters.length === 0 && (
                            <SelectItem value="Microsoft Print to PDF">Microsoft Print to PDF</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline" size="icon"
                        onClick={fetchOsPrinters}
                        disabled={isLoadingPrinters}
                        title="Refresh printer list"
                        className="rounded-xl"
                      >
                        <RefreshCw className={`w-4 h-4 ${isLoadingPrinters ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Detected from OS spooler. Refresh to update.</p>
                  </div>

                  {/* Connection port */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Connection Port / Method</Label>
                    <Select value={settings.ConnectionPort} onValueChange={v => setSetting("ConnectionPort", v)}>
                      <SelectTrigger className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="USB">USB (Spooler)</SelectItem>
                        <SelectItem value="COM1">COM1</SelectItem>
                        <SelectItem value="COM2">COM2</SelectItem>
                        <SelectItem value="COM3">COM3</SelectItem>
                        <SelectItem value="LPT1">LPT1</SelectItem>
                        <SelectItem value="LAN">LAN / Network</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Printer type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Printer Type</Label>
                    <Select value={settings.PrinterType} onValueChange={v => setSetting("PrinterType", v)}>
                      <SelectTrigger className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ESC/POS Thermal">ESC/POS Thermal</SelectItem>
                        <SelectItem value="A4">A4 Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Paper size */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Paper Width</Label>
                    <Select value={settings.PaperSize} onValueChange={v => setSetting("PaperSize", v)}>
                      <SelectTrigger className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="58mm">58 mm (Thermal)</SelectItem>
                        <SelectItem value="80mm">80 mm (Thermal)</SelectItem>
                        <SelectItem value="custom">Custom Width</SelectItem>
                        <SelectItem value="A4">A4 (Standard)</SelectItem>
                      </SelectContent>
                    </Select>
                    {settings.PaperSize === "custom" && (
                      <Input
                        type="number"
                        min={40} max={210}
                        value={settings.CustomPaperWidthMm ?? ""}
                        onChange={e => setSetting("CustomPaperWidthMm", parseInt(e.target.value) || null)}
                        placeholder="e.g. 72"
                        className="rounded-xl mt-2"
                      />
                    )}
                  </div>
                </div>

                {/* Copies + behaviours */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Number of Copies</Label>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="rounded-xl h-9 w-9"
                          onClick={() => setSetting("Copies", Math.max(1, settings.Copies - 1))}>-</Button>
                        <span className="font-bold text-lg w-8 text-center">{settings.Copies}</span>
                        <Button variant="outline" size="icon" className="rounded-xl h-9 w-9"
                          onClick={() => setSetting("Copies", Math.min(10, settings.Copies + 1))}>+</Button>
                      </div>
                    </div>
                  </div>

                  <ToggleRow
                    label="Auto-Print After Successful Sale"
                    description="Automatically print ESC/POS receipt when a sale is completed."
                    checked={settings.OpenPrintDialog}
                    onChange={v => setSetting("OpenPrintDialog", v)}
                  />
                  <ToggleRow
                    label="Open Print Dialog Before Printing"
                    description="Show OS print dialog instead of sending directly to printer."
                    checked={settings.OpenPrintDialog}
                    onChange={v => setSetting("OpenPrintDialog", v)}
                  />
                  <ToggleRow
                    label="Auto-Cut Paper After Receipt"
                    description="Send ESC/POS cut command (GS V) after printing."
                    checked={settings.AutoCutPaper}
                    onChange={v => setSetting("AutoCutPaper", v)}
                  />
                  <ToggleRow
                    label="Kick Cash Drawer on Cash Sale"
                    description="Trigger drawer pulse automatically for cash payment."
                    checked={settings.OpenCashDrawer}
                    onChange={v => setSetting("OpenCashDrawer", v)}
                  />
                </div>

                {/* Advanced hex */}
                <Accordion className="w-full">
                  <AccordionItem value="advanced">
                    <AccordionTrigger className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Advanced: Custom Hex Sequences
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        <Label>Cash Drawer Kick Sequence</Label>
                        <Textarea
                          value={settings.CustomRawByteSequence}
                          onChange={e => setSetting("CustomRawByteSequence", e.target.value)}
                          placeholder="\x1B\x70\x00\x19\xFA"
                          className="font-mono text-sm"
                          rows={2}
                        />
                        <p className="text-xs text-slate-500">
                          Standard ESC p: <code>\x1B\x70\x00\x19\xFA</code>. Parsed to raw bytes before dispatch.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──────── TAB 2: RECEIPT DESIGN ──────── */}
          <TabsContent value="design" className="space-y-6">

            {/* Layout controls */}
            <Card className={cardClass}>
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
                  <Settings2 className="w-5 h-5" /> Layout Controls
                </CardTitle>
                <CardDescription>Control paper width math, font scale, and column sizing.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* Receipt Title */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Receipt Title</Label>
                  <Input
                    value={settings.ReceiptTitle}
                    onChange={e => setSetting("ReceiptTitle", e.target.value.toUpperCase())}
                    placeholder="SALE RECEIPT"
                    className="rounded-xl font-mono uppercase"
                    maxLength={30}
                  />
                  <p className="text-xs text-slate-500">Printed in bold above the separator line.</p>
                </div>

                {/* Font scale slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold">Font Scale</Label>
                    <Badge variant="outline" className="font-mono">{settings.FontScale}%</Badge>
                  </div>
                  <Slider
                    min={60} max={150} step={5}
                    value={[settings.FontScale]}
                    onValueChange={(value) => {
                      const v = Array.isArray(value) ? value[0] : value;
                      setSetting("FontScale", v as number);
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>60% (Compact)</span><span>100% (Normal)</span><span>150% (Large)</span>
                  </div>
                </div>

                {/* CPL + Item name width */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Characters Per Line</Label>
                    <Input
                      type="number"
                      min={24} max={64}
                      value={settings.CharactersPerLine}
                      onChange={e => setSetting("CharactersPerLine", parseInt(e.target.value) || 42)}
                      className="rounded-xl font-mono"
                    />
                    <p className="text-xs text-slate-500">32 for 58mm · 42 for 80mm</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Item Name Width (cols)</Label>
                    <Input
                      type="number"
                      min={8} max={32}
                      value={settings.ItemNameWidth}
                      onChange={e => setSetting("ItemNameWidth", parseInt(e.target.value) || 16)}
                      className="rounded-xl font-mono"
                    />
                    <p className="text-xs text-slate-500">Columns for medicine name column.</p>
                  </div>
                </div>

                {/* Footer message */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Footer Message</Label>
                  <Textarea
                    value={settings.ReceiptFooterMessage}
                    onChange={e => setSetting("ReceiptFooterMessage", e.target.value)}
                    placeholder="Thank you for your visit!"
                    rows={3}
                    className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Content toggles */}
            <Card className={cardClass}>
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-transparent">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                  <Eye className="w-5 h-5" /> Content Visibility
                </CardTitle>
                <CardDescription>Enable or disable individual receipt fields.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* Header section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Pharmacy Header</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <ToggleRow label="Show Logo" checked={settings.ShowLogo} onChange={v => setSetting("ShowLogo", v)} />
                    <ToggleRow label="Show Pharmacy Name" checked={settings.ShowPharmacyName} onChange={v => setSetting("ShowPharmacyName", v)} />
                    <ToggleRow label="Show Address" checked={settings.ShowAddress} onChange={v => setSetting("ShowAddress", v)} />
                    <ToggleRow label="Show Phone Number" checked={settings.ShowPhoneNumber} onChange={v => setSetting("ShowPhoneNumber", v)} />
                    <ToggleRow label="Drug License &amp; NTN" checked={settings.PrintLicenseAndNtn} onChange={v => setSetting("PrintLicenseAndNtn", v)} />
                  </div>
                </div>

                {/* Invoice section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Invoice Information</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <ToggleRow label="Invoice Number" checked={settings.ShowInvoiceNumber} onChange={v => setSetting("ShowInvoiceNumber", v)} />
                    <ToggleRow label="Date" checked={settings.ShowDate} onChange={v => setSetting("ShowDate", v)} />
                    <ToggleRow label="Time" checked={settings.ShowTime} onChange={v => setSetting("ShowTime", v)} />
                    <ToggleRow label="Customer Name" checked={settings.ShowCustomerName} onChange={v => setSetting("ShowCustomerName", v)} />
                    <ToggleRow label="Cashier Name" checked={settings.ShowCashier} onChange={v => setSetting("ShowCashier", v)} />
                    <ToggleRow label="Payment Method" checked={settings.ShowPaymentMethod} onChange={v => setSetting("ShowPaymentMethod", v)} />
                    <ToggleRow label="Doctor &amp; Patient Info" checked={settings.PrintDoctorAndPatient} onChange={v => setSetting("PrintDoctorAndPatient", v)} />
                  </div>
                </div>

                {/* Items section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Medicine Items</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <ToggleRow label="Batch No. &amp; Expiry Date" checked={settings.PrintBatchAndExpiry} onChange={v => setSetting("PrintBatchAndExpiry", v)} />
                  </div>
                </div>

                {/* Totals section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Totals &amp; Payment</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <ToggleRow label="Subtotal" checked={settings.ShowSubtotal} onChange={v => setSetting("ShowSubtotal", v)} />
                    <ToggleRow label="Discount" checked={settings.ShowDiscount} onChange={v => setSetting("ShowDiscount", v)} />
                    <ToggleRow label="Tax" checked={settings.ShowTax} onChange={v => setSetting("ShowTax", v)} />
                    <ToggleRow label="Amount Paid" checked={settings.ShowAmountPaid} onChange={v => setSetting("ShowAmountPaid", v)} />
                    <ToggleRow label="Change Due" checked={settings.ShowChangeDue} onChange={v => setSetting("ShowChangeDue", v)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── RIGHT COLUMN: Preview + Actions ──────────────────────────────── */}
      <div className="space-y-4 lg:sticky lg:top-6">

        {/* Preview card */}
        <Card className={`${cardClass} overflow-auto`}>
          <CardHeader className="bg-slate-50/50 dark:bg-secondary/20 pb-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Live Receipt Preview
              <Badge variant="secondary" className="ml-auto text-xs">
                {settings.PaperSize}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ReceiptPreview
              settings={settings}
              pharmacyName={pharmacyName}
              pharmacyAddress={pharmacyAddress}
              pharmacyPhone={pharmacyPhone}
              currency={currency}
              licenseInfo={licenseInfo}
            />
          </CardContent>
        </Card>

        {/* Action buttons */}
        <Card className={cardClass}>
          <CardContent className="p-4 space-y-3">
            <SaveButton isSaving={isSaving} onClick={handleSave} className="w-full" label="Save Settings" />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleTestPrint}
                disabled={isTesting}
                variant="outline"
                className="h-10 rounded-xl font-semibold text-sm"
              >
                {isTesting
                  ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  : <Printer className="w-4 h-4 mr-1.5 text-indigo-500" />}
                Test Print
              </Button>
              <Button
                onClick={handleTestDrawer}
                disabled={isTestingDrawer}
                variant="outline"
                className="h-10 rounded-xl font-semibold text-sm"
              >
                {isTestingDrawer
                  ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  : <Usb className="w-4 h-4 mr-1.5 text-emerald-500" />}
                Test Drawer
              </Button>
            </div>
            <Button
              onClick={fetchSettings}
              variant="ghost"
              className="w-full h-9 rounded-xl text-xs text-slate-500"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload from Server
            </Button>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Paper", value: settings.PaperSize, icon: <Copy className="w-3 h-3" /> },
            { label: "Scale", value: `${settings.FontScale}%`, icon: <Zap className="w-3 h-3" /> },
            { label: "Copies", value: settings.Copies, icon: <Copy className="w-3 h-3" /> },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
              <div className="text-lg font-black text-slate-800 dark:text-white">{s.value}</div>
              <div className="text-[10px] font-semibold uppercase text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
