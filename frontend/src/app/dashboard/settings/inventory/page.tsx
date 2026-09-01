"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RefreshCw, Box, AlertTriangle, Barcode, Settings2 } from "lucide-react";
import { useInventorySettings } from "@/contexts/InventorySettingsContext";
import { SaveButton } from "@/components/ui/save-button";

interface InventorySettings {
  SettingsId?: number;
  LowStockThreshold: number;
  ExpiryAlertDays: number;
  AllowNegativeStock: boolean;
  DefaultUnit: string;
  AutoGenerateBarcode: boolean;
  PreventSaleOfExpired: boolean;
  EnableFefo: boolean;
  DefaultProfitMargin: number;
}

const DEFAULT_SETTINGS: InventorySettings = {
  LowStockThreshold: 10,
  ExpiryAlertDays: 90,
  AllowNegativeStock: false,
  DefaultUnit: "Box",
  AutoGenerateBarcode: true,
  PreventSaleOfExpired: true,
  EnableFefo: true,
  DefaultProfitMargin: 0.0,
};

export default function InventorySettingsPage() {
  const [settings, setSettings] = useState<InventorySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customExpiryMode, setCustomExpiryMode] = useState(false);
  const { refreshInventorySettings } = useInventorySettings();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/inventory");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        setCustomExpiryMode(![30, 60, 90, 180].includes(data.ExpiryAlertDays));
      } else {
        toast.error("Failed to load inventory settings");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("Inventory Settings updated successfully!");
        await refreshInventorySettings();
      } else {
        toast.error("Failed to update inventory settings.");
      }
    } catch (error) {
      toast.error("Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setSettings({ 
      ...settings, 
      [name]: type === 'number' ? parseInt(value) || 0 : value 
    });
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings({ ...settings, [name]: checked });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 items-start pr-2 lg:pr-4">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Alerts & Thresholds */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(245,158,11,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-amber-700 dark:text-amber-500">
                <AlertTriangle className="w-5 h-5 drop-shadow-sm" /> Alerts & Thresholds
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Configure when the system warns you about low stock or impending expiries.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Low Stock Threshold (Units)</Label>
                <Input type="number" name="LowStockThreshold" value={settings.LowStockThreshold} onChange={handleChange} className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-amber-500/30 focus-visible:border-amber-500 transition-all shadow-sm" />
                <p className="text-xs text-muted-foreground">Warn when stock falls below this amount.</p>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Expiry Alert Horizon (Days)</Label>
                <Select 
                  value={customExpiryMode ? "custom" : String(settings.ExpiryAlertDays)} 
                  onValueChange={(val) => {
                    if (val === "custom") {
                      setCustomExpiryMode(true);
                    } else {
                      setCustomExpiryMode(false);
                      setSettings({...settings, ExpiryAlertDays: parseInt(val)});
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm">
                    <SelectValue placeholder="Select alert horizon" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {customExpiryMode && (
                  <Input 
                    type="number" 
                    min="1"
                    className="mt-2 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-amber-500/30 focus-visible:border-amber-500 transition-all shadow-sm"
                    placeholder="Enter custom days" 
                    value={settings.ExpiryAlertDays}
                    onChange={(e) => setSettings({...settings, ExpiryAlertDays: parseInt(e.target.value) || 0})}
                  />
                )}
                <p className="text-xs text-muted-foreground">Alert this many days before expiration.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock & Dispensing Safeguards */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(239,68,68,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-red-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-red-700 dark:text-red-500">
                <AlertTriangle className="w-5 h-5 drop-shadow-sm" /> Stock & Dispensing Safeguards
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Strict compliance rules and stock flow enforcements at POS.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-7 space-y-4">
            
            <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <div className="flex items-start gap-3">
                <Box className="w-5 h-5 mt-0.5 text-red-500" />
                <div>
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Block Sale of Expired Medicines</Label>
                  <p className="text-xs text-slate-500 mt-1">Strictly prevent POS checkout for any expired stock batch.</p>
                </div>
              </div>
              <Switch checked={settings.PreventSaleOfExpired} onCheckedChange={(c) => handleSwitchChange("PreventSaleOfExpired", c)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 mt-0.5 text-blue-500" />
                <div>
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Allow Negative Inventory / Over-Selling</Label>
                  <p className="text-xs text-slate-500 mt-1">Permit billing even if system stock shows zero or negative.</p>
                </div>
              </div>
              <Switch checked={settings.AllowNegativeStock} onCheckedChange={(c) => handleSwitchChange("AllowNegativeStock", c)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 mt-0.5 text-emerald-500" />
                <div>
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Enforce FEFO Batch Selection</Label>
                  <p className="text-xs text-slate-500 mt-1">Auto-select batches with nearest expiry dates during POS checkout.</p>
                </div>
              </div>
              <Switch checked={settings.EnableFefo} onCheckedChange={(c) => handleSwitchChange("EnableFefo", c)} />
            </div>

          </CardContent>
        </Card>

        {/* Product Defaults */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
                <Settings2 className="w-5 h-5 drop-shadow-sm" /> Default Configurations
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Speed up product creation by configuring default types.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-7 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Default Product Unit</Label>
              <Select 
                value={settings.DefaultUnit} 
                onValueChange={(val) => setSettings({...settings, DefaultUnit: val})}
              >
                <SelectTrigger className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-sm">
                  <SelectValue placeholder="Select default unit" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Box">Box</SelectItem>
                  <SelectItem value="Strip">Strip</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Bottle">Bottle</SelectItem>
                  <SelectItem value="Vial">Vial</SelectItem>
                  <SelectItem value="Sachet">Sachet</SelectItem>
                  <SelectItem value="Syrup">Syrup</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Default Retail Profit Margin (%)</Label>
              <Input type="number" name="DefaultProfitMargin" value={settings.DefaultProfitMargin} onChange={handleChange} step="0.1" className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              <p className="text-xs text-muted-foreground">Auto-calculates sell price on purchase entry.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <div className="flex items-start gap-3">
                <Barcode className="w-5 h-5 mt-0.5 text-slate-500" />
                <div>
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">Auto-Generate Barcodes</Label>
                  <p className="text-xs text-slate-500 mt-1">Automatically create standard EAN/UPC placeholders if none is provided.</p>
                </div>
              </div>
              <Switch checked={settings.AutoGenerateBarcode} onCheckedChange={(c) => handleSwitchChange("AutoGenerateBarcode", c)} />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 rounded-2xl sticky top-0 self-start">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <Box className="w-5 h-5 mr-2 text-indigo-600" /> Live Rules Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-sm">
            

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Automated Triggers</h4>
              <ul className="space-y-3 pt-2">
                <li className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Low Stock</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/30">&lt; {settings.LowStockThreshold} Items</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Expiry Alert</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/30">&lt; {settings.ExpiryAlertDays} Days</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Expired Sale Block</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-md border ${settings.PreventSaleOfExpired ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/30" : "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700"}`}>
                    {settings.PreventSaleOfExpired ? "Enabled" : "Disabled"}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Negative Stock</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-md border ${settings.AllowNegativeStock ? "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900/30" : "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700"}`}>
                    {settings.AllowNegativeStock ? "Allowed" : "Blocked"}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">FEFO Sorting</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-md border ${settings.EnableFefo ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/30" : "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700"}`}>
                    {settings.EnableFefo ? "Active" : "Inactive"}
                  </span>
                </li>
              </ul>
            </div>
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <SaveButton isSaving={isSaving} onClick={handleSave} className="w-full" label="Save Settings" />
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

