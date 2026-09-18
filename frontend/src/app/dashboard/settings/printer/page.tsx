"use client";
import { getApiBaseUrl } from "@/lib/api-client";
import { PrinterSettings } from "@/types/printer";
import { ReceiptPreview } from "@/components/receipt-preview";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Save, RefreshCw, Printer, Usb, Receipt, AlertTriangle,
  CheckCircle2, Server, Settings2, Eye, Copy, Zap, UploadCloud, Image as ImageIcon, Trash2, Building
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SaveButton } from "@/components/ui/save-button";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: PrinterSettings = {
  PharmacyName: "My Pharmacy",
  PharmacyAddress: null,
  PharmacyPhone: null,
  DrugLicenseNumber: null,
  NtnStrn: null,
  Website: null,
  ReceiptLogoPath: null,
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
  PrintLicenseAndNtn: false,
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PrinterSettingsPage() {
  const [activeTab, setActiveTab] = useState("hardware");
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [osPrinters, setOsPrinters] = useState<string[]>([]);
  const [printerWarning, setPrinterWarning] = useState<string | null>(null);

  // Pharmacy data for preview
  const [pharmacyName, setPharmacyName] = useState("City Pharmacy");
  const [pharmacyAddress, setPharmacyAddress] = useState("123 Health Street, Lahore");
  const [pharmacyPhone, setPharmacyPhone] = useState("+92 300 1234567");
  const [currency, setCurrency] = useState("Rs");
  const [licenseInfo, setLicenseInfo] = useState("Lic: DL-12345 / NTN: 9876543-2");

  const [logoFileToUpload, setLogoFileToUpload] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
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
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};
      const [printerRes, billingRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/settings/printer`, { headers }),
        fetch(`${getApiBaseUrl()}/settings/billing`, { headers }),
      ]);

      if (printerRes.ok) {
        const data = await printerRes.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        
        if (data.PharmacyName) setPharmacyName(data.PharmacyName);
        if (data.PharmacyAddress) setPharmacyAddress(data.PharmacyAddress);
        if (data.PharmacyPhone) setPharmacyPhone(data.PharmacyPhone);
        if (data.DrugLicenseNumber || data.NtnStrn) {
          setLicenseInfo(`Lic: ${data.DrugLicenseNumber || "N/A"} / NTN: ${data.NtnStrn || "N/A"}`);
        }
        
        if (data.ReceiptLogoPath) {
          const path = data.ReceiptLogoPath.startsWith('/') ? data.ReceiptLogoPath : `/${data.ReceiptLogoPath}`;
          setLogoPreviewUrl(`${getApiBaseUrl().replace("/api/v1","")}${path}`);
        } else {
          setLogoPreviewUrl(null);
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
      const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};
      
      const res = await fetch(`${getApiBaseUrl()}/settings/printer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        toast.error("Failed to save settings.");
        return;
      }
      
      if (logoFileToUpload) {
        const formData = new FormData();
        formData.append("file", logoFileToUpload);
        const uploadRes = await fetch(`${getApiBaseUrl()}/settings/printer/receipt-logo`, {
          method: "POST",
          headers,
          body: formData
        });
        if (!uploadRes.ok) toast.error("Failed to upload logo.");
        else { setLogoFileToUpload(null); setLogoRemoved(false); }
      } else if (logoRemoved) {
        await fetch(`${getApiBaseUrl()}/settings/printer/receipt-logo`, {
          method: "DELETE",
          headers
        });
        setLogoRemoved(false);
      }

      toast.success("Printer & Receipt settings saved!");
      fetchSettings(); // Refresh to get updated logo path
      
      // Update global profile context so that topbar updates immediately
      window.dispatchEvent(new Event("profile-updated"));
    } catch {
      toast.error("Network error.");
    } finally {
      setIsSaving(false);
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
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-border mb-6 mt-10">
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab("hardware")}
              className={cn(
                "flex items-center px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
                activeTab === "hardware" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <Server className="mr-2 h-4 w-4" />
              Printers & Copies
            </button>
            <button
              onClick={() => setActiveTab("design")}
              className={cn(
                "flex items-center px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
                activeTab === "design" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <Receipt className="mr-2 h-4 w-4" />
              Receipt Design
            </button>
          </div>
        </div>

        {/* ──────── TAB 1: PRINTERS & COPIES ──────── */}
        {activeTab === "hardware" && (
          <div className="space-y-6">

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


              </CardContent>
            </Card>
          </div>
        )}

        {/* ──────── TAB 2: RECEIPT DESIGN ──────── */}
        {activeTab === "design" && (
          <div className="space-y-6">

            {/* Layout controls */}
            <Card className={cardClass}>
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
                  <Settings2 className="w-5 h-5" /> Layout Controls
                </CardTitle>
                <CardDescription>Control paper width math, font scale, and column sizing.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                
                {/* Pharmacy Branding */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Pharmacy Branding</h3>
                  
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="space-y-3 shrink-0">
                      <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Receipt Logo</Label>
                      <div 
                        className="w-32 h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer overflow-hidden relative group"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {logoPreviewUrl ? (
                          <>
                            <img src={logoPreviewUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <UploadCloud className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-slate-400">
                            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-[10px] font-medium text-center px-4">Click to upload<br/>(PNG/JPG)</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setLogoFileToUpload(file);
                              setLogoPreviewUrl(URL.createObjectURL(file));
                              setLogoRemoved(false);
                            }
                          }}
                        />
                      </div>
                      
                      {logoPreviewUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            setLogoPreviewUrl(null);
                            setLogoFileToUpload(null);
                            setLogoRemoved(true);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove Logo
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <div className="space-y-2">
                        <Label>Pharmacy Name</Label>
                        <Input
                          value={settings.PharmacyName || ""}
                          onChange={e => { setSetting("PharmacyName", e.target.value); setPharmacyName(e.target.value); }}
                          placeholder="e.g. City Pharmacy"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={settings.PharmacyPhone || ""}
                          onChange={e => { setSetting("PharmacyPhone", e.target.value); setPharmacyPhone(e.target.value); }}
                          placeholder="e.g. +92 300 1234567"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Address</Label>
                        <Input
                          value={settings.PharmacyAddress || ""}
                          onChange={e => { setSetting("PharmacyAddress", e.target.value); setPharmacyAddress(e.target.value); }}
                          placeholder="e.g. 123 Health Street, City"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Drug License Number</Label>
                        <Input
                          value={settings.DrugLicenseNumber || ""}
                          onChange={e => { setSetting("DrugLicenseNumber", e.target.value); setLicenseInfo(`Lic: ${e.target.value || "N/A"} / NTN: ${settings.NtnStrn || "N/A"}`); }}
                          placeholder="e.g. DL-123456"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>NTN / STRN</Label>
                        <Input
                          value={settings.NtnStrn || ""}
                          onChange={e => { setSetting("NtnStrn", e.target.value); setLicenseInfo(`Lic: ${settings.DrugLicenseNumber || "N/A"} / NTN: ${e.target.value || "N/A"}`); }}
                          placeholder="e.g. 1234567-8"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>

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
          </div>
        )}
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
            <ReceiptPreview settings={settings} currency={currency} />
          </CardContent>
        </Card>

        {/* Action buttons */}
        <Card className={cardClass}>
          <CardContent className="p-4">
            <SaveButton isSaving={isSaving} onClick={handleSave} className="w-full" label="Save Settings" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
