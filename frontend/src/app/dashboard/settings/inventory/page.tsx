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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/inventory");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 items-start lg:pr-6">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Alerts & Thresholds */}
        <Card className="border-amber-100 dark:border-amber-900 shadow-sm">
          <CardHeader className="pb-4 border-b bg-amber-50/50 dark:bg-amber-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Alerts & Thresholds
            </CardTitle>
            <CardDescription>Configure when the system warns you about low stock or impending expiries.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Low Stock Threshold (Units)</Label>
                <Input type="number" name="LowStockThreshold" value={settings.LowStockThreshold} onChange={handleChange} />
                <p className="text-xs text-muted-foreground">Warn when stock falls below this amount.</p>
              </div>
              <div className="space-y-2">
                <Label>Expiry Alert Horizon (Days)</Label>
                <Select 
                  value={String(settings.ExpiryAlertDays)} 
                  onValueChange={(val) => setSettings({...settings, ExpiryAlertDays: parseInt(val)})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select alert horizon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Alert this many days before expiration.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock & Dispensing Safeguards */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Stock & Dispensing Safeguards
            </CardTitle>
            <CardDescription>Strict compliance rules and stock flow enforcements at POS.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <Box className="w-5 h-5 mt-0.5 text-red-400" />
                <div>
                  <Label className="text-sm font-semibold">Block Sale of Expired Medicines</Label>
                  <p className="text-xs text-slate-500">Strictly prevent POS checkout for any expired stock batch.</p>
                </div>
              </div>
              <Switch checked={settings.PreventSaleOfExpired} onCheckedChange={(c) => handleSwitchChange("PreventSaleOfExpired", c)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 mt-0.5 text-blue-400" />
                <div>
                  <Label className="text-sm font-semibold">Allow Negative Inventory / Over-Selling</Label>
                  <p className="text-xs text-slate-500">Permit billing even if system stock shows zero or negative.</p>
                </div>
              </div>
              <Switch checked={settings.AllowNegativeStock} onCheckedChange={(c) => handleSwitchChange("AllowNegativeStock", c)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 mt-0.5 text-green-400" />
                <div>
                  <Label className="text-sm font-semibold">Enforce FEFO Batch Selection</Label>
                  <p className="text-xs text-slate-500">Auto-select batches with nearest expiry dates during POS checkout.</p>
                </div>
              </div>
              <Switch checked={settings.EnableFefo} onCheckedChange={(c) => handleSwitchChange("EnableFefo", c)} />
            </div>

          </CardContent>
        </Card>

        {/* Product Defaults */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-600" /> Default Configurations
            </CardTitle>
            <CardDescription>Speed up product creation by configuring default types.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label>Default Product Unit</Label>
              <Select 
                value={settings.DefaultUnit} 
                onValueChange={(val) => setSettings({...settings, DefaultUnit: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default unit" />
                </SelectTrigger>
                <SelectContent>
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

            <div className="space-y-2">
              <Label>Default Retail Profit Margin (%)</Label>
              <Input type="number" name="DefaultProfitMargin" value={settings.DefaultProfitMargin} onChange={handleChange} step="0.1" />
              <p className="text-xs text-muted-foreground">Auto-calculates sell price on purchase entry.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <Barcode className="w-5 h-5 mt-0.5 text-slate-400" />
                <div>
                  <Label className="text-sm font-semibold">Auto-Generate Barcodes</Label>
                  <p className="text-xs text-slate-500">Automatically create standard EAN/UPC placeholders if none is provided.</p>
                </div>
              </div>
              <Switch checked={settings.AutoGenerateBarcode} onCheckedChange={(c) => handleSwitchChange("AutoGenerateBarcode", c)} />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm sticky top-6">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 pb-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Box className="w-4 h-4" /> Live Rules Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-sm">
            

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white border-b pb-1">Automated Triggers</h4>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Low Stock</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">&lt; {settings.LowStockThreshold} Items</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Expiry Alert</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">&lt; {settings.ExpiryAlertDays} Days</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Expired Sale Block</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {settings.PreventSaleOfExpired ? "Enabled" : "Disabled"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Negative Stock</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {settings.AllowNegativeStock ? "Allowed" : "Blocked"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">FEFO Sorting</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {settings.EnableFefo ? "Active" : "Inactive"}
                  </span>
                </li>
              </ul>
            </div>
            
            <div className="pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 text-base shadow-sm">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
