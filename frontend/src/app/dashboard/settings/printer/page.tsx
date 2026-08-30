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
  
  const [isLoading, setIsLoading] = useState(true);
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 items-start lg:pr-6">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Hardware Configuration */}
        <Card className="border-blue-100 dark:border-blue-900 shadow-sm">
          <CardHeader className="pb-4 border-b bg-blue-50/50 dark:bg-blue-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Server className="w-5 h-5" /> Hardware Integration (ESC/POS)
            </CardTitle>
            <CardDescription>Configure OS printers, cash drawers, and auto-cutters.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <Label>System Printer Selection</Label>
                <div className="flex gap-2">
                  <Select 
                    value={settings.SelectedPrinterName} 
                    onValueChange={(val) => setSettings({...settings, SelectedPrinterName: val})}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select OS printer..." />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Button variant="outline" size="icon" onClick={fetchOsPrinters} disabled={isLoadingPrinters} title="Refresh OS Printers">
                    <RefreshCw className={`w-4 h-4 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Auto-detected Windows Spooler printers.</p>
              </div>

              <div className="space-y-2">
                <Label>Connection Port / Method</Label>
                <Select 
                  value={settings.ConnectionPort} 
                  onValueChange={(val) => setSettings({...settings, ConnectionPort: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USB">USB (Spooler)</SelectItem>
                    <SelectItem value="COM1">COM1</SelectItem>
                    <SelectItem value="COM2">COM2</SelectItem>
                    <SelectItem value="LPT1">LPT1</SelectItem>
                    <SelectItem value="LAN">LAN / Network</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Direct port access vs OS Spooler.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Printer Type</Label>
                <Select 
                  value={settings.PrinterType} 
                  onValueChange={(val) => setSettings({...settings, PrinterType: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESC/POS Thermal">ESC/POS Thermal</SelectItem>
                    <SelectItem value="A4">A4 Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paper Size</Label>
                <Select 
                  value={settings.PaperSize} 
                  onValueChange={(val) => setSettings({...settings, PaperSize: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm (Thermal)</SelectItem>
                    <SelectItem value="80mm">80mm (Thermal)</SelectItem>
                    <SelectItem value="A4">A4 (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hardware Commands */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Auto-Cut Paper After Receipt</Label>
                  <p className="text-xs text-slate-500">Send standard \x1D\x56\x41\x00 cut sequence on print completion.</p>
                </div>
                <Switch checked={settings.AutoCutPaper} onCheckedChange={(c) => handleSwitchChange("AutoCutPaper", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Kick Cash Drawer on Cash Sale</Label>
                  <p className="text-xs text-slate-500">Automatically trigger the cash drawer pulse for cash payment methods.</p>
                </div>
                <Switch checked={settings.OpenCashDrawer} onCheckedChange={(c) => handleSwitchChange("OpenCashDrawer", c)} />
              </div>
            </div>

            <Accordion type="single" collapsible="true" className="w-full">
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
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" /> Receipt Formatting & Toggles
            </CardTitle>
            <CardDescription>Control what information gets printed on customer receipts.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div><Label className="text-sm font-semibold">Print Pharmacy Logo</Label></div>
                <Switch checked={settings.ShowLogo} onCheckedChange={(c) => handleSwitchChange("ShowLogo", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div><Label className="text-sm font-semibold">Print Pharmacy Name</Label></div>
                <Switch checked={settings.ShowPharmacyName} onCheckedChange={(c) => handleSwitchChange("ShowPharmacyName", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div><Label className="text-sm font-semibold">Print Address & Contact</Label></div>
                <Switch checked={settings.ShowAddress} onCheckedChange={(c) => handleSwitchChange("ShowAddress", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div><Label className="text-sm font-semibold">Print Batch No. & Expiry</Label></div>
                <Switch checked={settings.PrintBatchAndExpiry} onCheckedChange={(c) => handleSwitchChange("PrintBatchAndExpiry", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div><Label className="text-sm font-semibold">Print Drug License & NTN</Label></div>
                <Switch checked={settings.PrintLicenseAndNtn} onCheckedChange={(c) => handleSwitchChange("PrintLicenseAndNtn", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div><Label className="text-sm font-semibold">Print Doctor & Patient Info</Label></div>
                <Switch checked={settings.PrintDoctorAndPatient} onCheckedChange={(c) => handleSwitchChange("PrintDoctorAndPatient", c)} />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label>Receipt Footer Message</Label>
              <Textarea 
                name="ReceiptFooterMessage" 
                value={settings.ReceiptFooterMessage} 
                onChange={handleChange} 
                placeholder="Thank you for shopping!"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews & Actions */}
      <div className="space-y-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm lg:sticky lg:top-6">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 pb-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Live Receipt Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-sm">
            
            {/* The Mock Receipt */}
            <div className={`mx-auto bg-white border border-slate-200 shadow-sm p-4 font-mono text-xs text-center text-slate-800 ${settings.PaperSize === '58mm' ? 'w-48' : 'w-64'} transition-all duration-300`}>
              {settings.ShowLogo && (
                <div className="mb-2 flex justify-center">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center border border-slate-300">
                    <span className="text-[10px] text-slate-400">LOGO</span>
                  </div>
                </div>
              )}
              {settings.ShowPharmacyName && (
                <div className="font-bold text-sm mb-1 uppercase tracking-tight">{pharmacyName}</div>
              )}
              {settings.ShowAddress && (
                <div className="mb-1 text-[10px] text-slate-600 leading-tight whitespace-pre-wrap">
                  {pharmacyAddress}
                </div>
              )}
              {settings.PrintLicenseAndNtn && (
                <div className="mb-3 text-[9px] text-slate-500 leading-tight uppercase">
                  {licenseInfo}
                </div>
              )}
              
              <div className="border-t border-dashed border-slate-300 my-2"></div>
              
              {settings.PrintDoctorAndPatient && (
                <>
                  <div className="text-left text-[10px] space-y-1 mb-2">
                    <div>Patient: John Doe</div>
                    <div>Dr: Dr. Smith (Reg: 12345)</div>
                  </div>
                  <div className="border-t border-dashed border-slate-300 my-2"></div>
                </>
              )}

              <div className="text-left space-y-2 mb-2">
                <div>
                  <div className="flex justify-between font-semibold"><span>Panadol 500mg (2x)</span><span>{currency} 100</span></div>
                  {settings.PrintBatchAndExpiry && <div className="text-[9px] text-slate-500">Batch: B123 | Exp: 12/26</div>}
                </div>
                <div>
                  <div className="flex justify-between font-semibold"><span>Amoxil Syrup (1x)</span><span>{currency} 250</span></div>
                  {settings.PrintBatchAndExpiry && <div className="text-[9px] text-slate-500">Batch: A456 | Exp: 05/27</div>}
                </div>
              </div>
              
              <div className="border-t border-dashed border-slate-300 my-2"></div>
              
              <div className="flex justify-between font-bold text-sm mb-4">
                <span>TOTAL:</span><span>{currency} 350</span>
              </div>
              
              {settings.ReceiptFooterMessage && (
                <div className="text-[10px] text-slate-600 whitespace-pre-wrap italic mt-4">
                  {settings.ReceiptFooterMessage}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 text-base shadow-sm">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleTestPrint} disabled={isTesting} variant="outline" className="h-10 border-slate-300 text-slate-700">
                  {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2 text-indigo-600" />}
                  Test Print
                </Button>
                <Button onClick={handleTestDrawer} disabled={isTestingDrawer} variant="outline" className="h-10 border-slate-300 text-slate-700">
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
