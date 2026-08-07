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
import { Save, RefreshCw, Printer, Usb, Receipt, Code, CheckCircle2 } from "lucide-react";

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
};

export default function PrinterSettingsPage() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        toast.error("Failed to load printer settings");
      }
    } catch (error) {
      toast.error("Network error while loading settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/printer/test", {
        method: "POST"
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings({ ...settings, [name]: checked });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Hardware Configuration */}
        <Card className="border-blue-100 dark:border-blue-900 shadow-sm">
          <CardHeader className="pb-4 border-b bg-blue-50/50 dark:bg-blue-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Printer className="w-5 h-5" /> Hardware Connection (ESC/POS)
            </CardTitle>
            <CardDescription>Configure direct hardware printing engine parameters.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="space-y-2">
                <Label>Printer Driver Name</Label>
                <Input 
                  name="SelectedPrinterName" 
                  value={settings.SelectedPrinterName} 
                  onChange={handleChange} 
                  placeholder="e.g. POS-80"
                />
                <p className="text-xs text-muted-foreground">Exact system name of the installed printer.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Connection Port</Label>
                <Select 
                  value={settings.ConnectionPort} 
                  onValueChange={(val) => setSettings({...settings, ConnectionPort: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USB">USB</SelectItem>
                    <SelectItem value="COM1">COM1</SelectItem>
                    <SelectItem value="COM2">COM2</SelectItem>
                    <SelectItem value="COM3">COM3</SelectItem>
                    <SelectItem value="LPT1">LPT1</SelectItem>
                    <SelectItem value="LAN">LAN / Network</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Physical connection interface.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced ESC/POS Codes */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-600" /> Advanced ESC/POS Commands
            </CardTitle>
            <CardDescription>Custom byte sequences for cash drawers and cutters.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Label>Raw Byte Sequence (Hex)</Label>
              <Textarea 
                name="CustomRawByteSequence" 
                value={settings.CustomRawByteSequence} 
                onChange={handleChange} 
                placeholder="\x1B\x70\x00\x19\xFA"
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Default <code>\x1B\x70\x00\x19\xFA</code> is standard ESC p for cash drawer kick. 
                Use <code>\x1B\x69</code> for partial cut, or <code>\x1B\x6D</code> for full cut.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Customization */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" /> Receipt Formatting
            </CardTitle>
            <CardDescription>Control what information gets printed on customer receipts.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Print Pharmacy Logo</Label>
                </div>
                <Switch checked={settings.ShowLogo} onCheckedChange={(c) => handleSwitchChange("ShowLogo", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Print Pharmacy Name</Label>
                </div>
                <Switch checked={settings.ShowPharmacyName} onCheckedChange={(c) => handleSwitchChange("ShowPharmacyName", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Print Address & Contact</Label>
                </div>
                <Switch checked={settings.ShowAddress} onCheckedChange={(c) => handleSwitchChange("ShowAddress", c)} />
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
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm sticky top-6">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 pb-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Live Receipt Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-sm">
            
            {/* The Mock Receipt */}
            <div className={`mx-auto bg-white border border-slate-200 shadow-sm p-4 font-mono text-xs text-center text-slate-800 ${settings.PaperSize === '58mm' ? 'w-48' : 'w-64'}`}>
              {settings.ShowLogo && (
                <div className="mb-2 flex justify-center">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center border border-slate-300">
                    <span className="text-[10px] text-slate-400">LOGO</span>
                  </div>
                </div>
              )}
              {settings.ShowPharmacyName && (
                <div className="font-bold text-sm mb-1 uppercase tracking-tight">Your Pharmacy Name</div>
              )}
              {settings.ShowAddress && (
                <div className="mb-3 text-[10px] text-slate-600 leading-tight">
                  123 Health Ave, City, Country<br/>Tel: +1 234 567 8900
                </div>
              )}
              
              <div className="border-t border-dashed border-slate-300 my-2"></div>
              
              <div className="text-left space-y-1 mb-2">
                <div className="flex justify-between"><span>Paracetamol 500mg</span><span>$5.00</span></div>
                <div className="flex justify-between"><span>Vitamin C</span><span>$12.50</span></div>
              </div>
              
              <div className="border-t border-dashed border-slate-300 my-2"></div>
              
              <div className="flex justify-between font-bold text-sm mb-4">
                <span>TOTAL:</span><span>$17.50</span>
              </div>
              
              {settings.ReceiptFooterMessage && (
                <div className="text-[10px] text-slate-600 whitespace-pre-wrap italic">
                  {settings.ReceiptFooterMessage}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 text-base shadow-sm">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <Button onClick={handleTestPrint} disabled={isTesting} variant="outline" className="w-full h-11 border-slate-300 text-slate-700">
                {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2 text-indigo-600" />}
                {isTesting ? "Sending to Printer..." : "Test ESC/POS Print"}
              </Button>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
