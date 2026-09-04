"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, RefreshCw, Printer, Usb, Receipt, Code, CheckCircle2, Server } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SaveButton } from "@/components/ui/save-button";

interface PrinterSettings {
  SettingsId?: number;
  PrinterType: string;
  PaperSize: string;
  SelectedPrinterName: string;
  ConnectionPort: string;
  CustomRawByteSequence: string;
  ShowLogo: boolean;
  ShowPharmacyName: boolean;
  ShowAddress: boolean;
  ReceiptFooterMessage: string;
  AutoCutPaper: boolean;
  OpenCashDrawer: boolean;
  PrintBatchAndExpiry: boolean;
  PrintLicenseAndNtn: boolean;
  PrintDoctorAndPatient: boolean;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  PrinterType: "ESC/POS Thermal",
  PaperSize: "80mm",
  SelectedPrinterName: "",
  ConnectionPort: "USB",
  CustomRawByteSequence: "\\x1B\\x70\\x00\\x19\\xFA",
  ShowLogo: true,
  ShowPharmacyName: true,
  ShowAddress: true,
  ReceiptFooterMessage: "Thank you for your visit! Wishing you good health.",
  AutoCutPaper: true,
  OpenCashDrawer: true,
  PrintBatchAndExpiry: true,
  PrintLicenseAndNtn: false,
  PrintDoctorAndPatient: false,
};

export default function PrinterSettingsPage() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [osPrinters, setOsPrinters] = useState<string[]>([]);
  const [pharmacyName, setPharmacyName] = useState("Your Pharmacy Name");
  const [pharmacyAddress, setPharmacyAddress] = useState("123 Health Ave, City, Country\\nTel: +1 234 567 8900");
  const [currency, setCurrency] = useState("Rs");
  const [licenseInfo, setLicenseInfo] = useState("License: XYZ123 / NTN: 9876543-2");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingDrawer, setIsTestingDrawer] = useState(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchOsPrinters();
  }, []);

  const fetchSettings = async () => {
    try {
      const [printerRes, profileRes, billingRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/v1/settings/printer"),
        fetch("http://127.0.0.1:8000/api/v1/settings/pharmacy-profile"),
        fetch("http://127.0.0.1:8000/api/v1/settings/billing")
      ]);
      
      if (printerRes.ok) {
        const data = await printerRes.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
      
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.PharmacyName) setPharmacyName(profile.PharmacyName);
        if (profile.Address) setPharmacyAddress(`${profile.Address}\\nTel: ${profile.Phone || ''}`);
        if (profile.DrugLicenseNo || profile.NtnNumber) {
          setLicenseInfo(`License: ${profile.DrugLicenseNo || 'N/A'} / NTN: ${profile.NtnNumber || 'N/A'}`);
        }
      }
      
      if (billingRes.ok) {
        const billing = await billingRes.json();
        if (billing.CurrencySymbol) setCurrency(billing.CurrencySymbol);
      }
    } catch (error) {
      toast.error("Network error while loading settings");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOsPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer/list");
      if (res.ok) {
        const data = await res.json();
        setOsPrinters(data.data || []);
      }
    } catch (error) {
      console.error("Failed to load OS printers", error);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("Printer Settings updated successfully!");
      } else {
        toast.error("Failed to update printer settings.");
      }
    } catch (error) {
      toast.error("Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer/test", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Test print sent successfully!");
      } else {
        toast.error("Failed to send test print.");
      }
    } catch (error) {
      toast.error("Network error during test print.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestDrawer = async () => {
    setIsTestingDrawer(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer/test-drawer", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Cash drawer kick sent!");
      } else {
        toast.error("Failed to send cash drawer signal.");
      }
    } catch (error) {
      toast.error("Network error during drawer test.");
    } finally {
      setIsTestingDrawer(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleSwitchChange = (name: keyof PrinterSettings, checked: boolean) => {
    setSettings({ ...settings, [name]: checked });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 items-start pr-2 lg:pr-4">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Hardware Configuration */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-blue-700 dark:text-blue-500">
                <Server className="w-5 h-5 drop-shadow-sm" /> Hardware Integration (ESC/POS)
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Configure OS printers, cash drawers, and auto-cutters.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-3">
                <Label className="text-sm font-semibold">System Printer Selection</Label>
                <div className="flex gap-2">
                  <Select 
                    value={settings.SelectedPrinterName} 
                    onValueChange={(val) => setSettings({...settings, SelectedPrinterName: val})}
                  >
                    <SelectTrigger className="flex-1 rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm">
                      <SelectValue placeholder="Select OS printer..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {osPrinters.length > 0 ? (
                        osPrinters.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="_none" disabled>No OS printers detected</SelectItem>
                          <SelectItem value="Microsoft Print to PDF">Microsoft Print to PDF (Mock)</SelectItem>
                          <SelectItem value="Generic / Text Only">Generic / Text Only (Mock)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchOsPrinters} disabled={isLoadingPrinters} title="Refresh OS Printers" className="rounded-xl border-border hover:bg-secondary">
                    <RefreshCw className={`w-4 h-4 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Auto-detected Windows Spooler printers.</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Connection Port / Method</Label>
                <Select 
                  value={settings.ConnectionPort} 
                  onValueChange={(val) => setSettings({...settings, ConnectionPort: val})}
                >
                  <SelectTrigger className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm">
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="USB">USB (Spooler)</SelectItem>
                    <SelectItem value="COM1">COM1</SelectItem>
                    <SelectItem value="COM2">COM2</SelectItem>
                    <SelectItem value="LPT1">LPT1</SelectItem>
                    <SelectItem value="LAN">LAN / Network</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Direct port access vs OS Spooler.</p>
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Printer Type</Label>
                <Select 
                  value={settings.PrinterType} 
                  onValueChange={(val) => setSettings({...settings, PrinterType: val})}
                >
                  <SelectTrigger className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ESC/POS Thermal">ESC/POS Thermal</SelectItem>
                    <SelectItem value="A4">A4 Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Paper Size</Label>
                <Select 
                  value={settings.PaperSize} 
                  onValueChange={(val) => setSettings({...settings, PaperSize: val})}
                >
                  <SelectTrigger className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="58mm">58mm (Thermal)</SelectItem>
                    <SelectItem value="80mm">80mm (Thermal)</SelectItem>
                    <SelectItem value="A4">A4 (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hardware Commands */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div>
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Auto-Cut Paper After Receipt</Label>
                  <p className="text-xs text-slate-500 mt-1">Send standard \x1D\x56\x41\x00 cut sequence on print completion.</p>
                </div>
                <Switch checked={settings.AutoCutPaper} onCheckedChange={(c) => handleSwitchChange("AutoCutPaper", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div>
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Kick Cash Drawer on Cash Sale</Label>
                  <p className="text-xs text-slate-500 mt-1">Automatically trigger the cash drawer pulse for cash payment methods.</p>
                </div>
                <Switch checked={settings.OpenCashDrawer} onCheckedChange={(c) => handleSwitchChange("OpenCashDrawer", c)} />
              </div>
            </div>

            <Accordion className="w-full">
              <AccordionItem value="advanced-hex">
                <AccordionTrigger className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Advanced Custom Hex Sequences
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <Label>Cash Drawer Kick Sequence</Label>
                    <Textarea 
                      name="CustomRawByteSequence" 
                      value={settings.CustomRawByteSequence} 
                      onChange={handleChange} 
                      placeholder="\x1B\x70\x00\x19\xFA"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500">
                      Standard ESC p sequence: <code>\x1B\x70\x00\x19\xFA</code>. 
                      Parsed securely to raw binary bytes before transmission.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Receipt Customization */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
                <Receipt className="w-5 h-5 drop-shadow-sm" /> Receipt Formatting & Toggles
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Control what information gets printed on customer receipts.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div><Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Print Pharmacy Logo</Label></div>
                <Switch checked={settings.ShowLogo} onCheckedChange={(c) => handleSwitchChange("ShowLogo", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div><Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Print Pharmacy Name</Label></div>
                <Switch checked={settings.ShowPharmacyName} onCheckedChange={(c) => handleSwitchChange("ShowPharmacyName", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div><Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Print Address & Contact</Label></div>
                <Switch checked={settings.ShowAddress} onCheckedChange={(c) => handleSwitchChange("ShowAddress", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div><Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Print Batch No. & Expiry</Label></div>
                <Switch checked={settings.PrintBatchAndExpiry} onCheckedChange={(c) => handleSwitchChange("PrintBatchAndExpiry", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div><Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Print Drug License & NTN</Label></div>
                <Switch checked={settings.PrintLicenseAndNtn} onCheckedChange={(c) => handleSwitchChange("PrintLicenseAndNtn", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div><Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Print Doctor & Patient Info</Label></div>
                <Switch checked={settings.PrintDoctorAndPatient} onCheckedChange={(c) => handleSwitchChange("PrintDoctorAndPatient", c)} />
              </div>
            </div>

            <div className="space-y-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Label className="text-sm font-semibold">Receipt Footer Message</Label>
              <Textarea 
                name="ReceiptFooterMessage" 
                value={settings.ReceiptFooterMessage} 
                onChange={handleChange} 
                placeholder="Thank you for shopping!"
                rows={3}
                className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm resize-none"
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews & Actions */}
      <div className="space-y-6">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 rounded-2xl lg:sticky lg:top-6">
          <CardHeader className="bg-slate-50/50 dark:bg-secondary/20 pb-5 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <CheckCircle2 className="w-5 h-5 text-green-500" /> Live Receipt Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* The Mock Receipt */}
            <div className={`mx-auto bg-white border border-slate-200 shadow-md p-5 font-mono text-xs text-center text-slate-800 ${settings.PaperSize === '58mm' ? 'w-48' : 'w-64'} transition-all duration-300 relative`}>
              {/* Subtle top cut marks */}
              <div className="absolute top-0 left-0 w-full flex justify-between px-1 h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent"></div>
              
              {settings.ShowLogo && (
                <div className="mb-3 flex justify-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 shadow-inner">
                    <span className="text-[10px] text-slate-400 font-bold">LOGO</span>
                  </div>
                </div>
              )}
              {settings.ShowPharmacyName && (
                <div className="font-extrabold text-sm mb-1 uppercase tracking-tight text-slate-900">{pharmacyName}</div>
              )}
              {settings.ShowAddress && (
                <div className="mb-2 text-[10px] text-slate-600 leading-tight whitespace-pre-wrap font-medium">
                  {pharmacyAddress}
                </div>
              )}
              {settings.PrintLicenseAndNtn && (
                <div className="mb-4 text-[9px] text-slate-500 leading-tight uppercase font-medium">
                  {licenseInfo}
                </div>
              )}
              
              <div className="border-t border-dashed border-slate-300 my-3"></div>
              
              {settings.PrintDoctorAndPatient && (
                <>
                  <div className="text-left text-[10px] space-y-1 mb-3 text-slate-700">
                    <div>Patient: John Doe</div>
                    <div>Dr: Dr. Smith (Reg: 12345)</div>
                  </div>
                  <div className="border-t border-dashed border-slate-300 my-3"></div>
                </>
              )}

              <div className="text-left space-y-2.5 mb-3 text-slate-800">
                <div>
                  <div className="flex justify-between font-bold"><span>Panadol 500mg (2x)</span><span>{currency} 100</span></div>
                  {settings.PrintBatchAndExpiry && <div className="text-[9px] text-slate-500 font-medium">Batch: B123 | Exp: 12/26</div>}
                </div>
                <div>
                  <div className="flex justify-between font-bold"><span>Amoxil Syrup (1x)</span><span>{currency} 250</span></div>
                  {settings.PrintBatchAndExpiry && <div className="text-[9px] text-slate-500 font-medium">Batch: A456 | Exp: 05/27</div>}
                </div>
              </div>
              
              <div className="border-t border-dashed border-slate-300 my-3"></div>
              
              <div className="flex justify-between font-extrabold text-sm mb-5 text-slate-900">
                <span>TOTAL:</span><span>{currency} 350</span>
              </div>
              
              {settings.ReceiptFooterMessage && (
                <div className="text-[10px] text-slate-600 whitespace-pre-wrap italic mt-5 font-medium">
                  {settings.ReceiptFooterMessage}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
              <SaveButton isSaving={isSaving} onClick={handleSave} className="w-full" label="Save Settings" />
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleTestPrint} disabled={isTesting} variant="outline" className="h-11 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all font-semibold">
                  {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2 text-indigo-600" />}
                  Test Print
                </Button>
                <Button onClick={handleTestDrawer} disabled={isTestingDrawer} variant="outline" className="h-11 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all font-semibold">
                  {isTestingDrawer ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Usb className="w-4 h-4 mr-2 text-emerald-600" />}
                  Test Drawer
                </Button>
              </div>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

