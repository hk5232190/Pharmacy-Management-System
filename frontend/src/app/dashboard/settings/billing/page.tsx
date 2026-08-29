"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RefreshCw, Receipt, ShieldAlert, DollarSign, Calculator, Settings2 } from "lucide-react";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";

interface BillingSettings {
  SettingsId?: number;
  Currency: string;
  CurrencySymbol: string;
  TaxEnabled: boolean;
  DefaultTaxRate: number;
  DiscountEnabled: boolean;
  MaxDiscountPercentage: number;
  AdminDiscountThreshold: number;
  RequireAdminPinForDiscount: boolean;
  InvoicePrefix: string;
  NextInvoiceNumber: number;
  DefaultPaymentMethod: string;
  AutoPrintReceipt: boolean;
  ShowKeyboardShortcuts: boolean;
}

const DEFAULT_SETTINGS: BillingSettings = {
  Currency: "PKR",
  CurrencySymbol: "Rs",
  TaxEnabled: false,
  DefaultTaxRate: 0.0,
  DiscountEnabled: true,
  MaxDiscountPercentage: 100.0,
  AdminDiscountThreshold: 10.0,
  RequireAdminPinForDiscount: true,
  InvoicePrefix: "INV-",
  NextInvoiceNumber: 1,
  DefaultPaymentMethod: "Cash",
  AutoPrintReceipt: true,
  ShowKeyboardShortcuts: true,
};

export default function BillingSettingsPage() {
  const [settings, setSettings] = useState<BillingSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { refreshPreferences } = useSystemPreferences();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/billing");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        toast.error("Failed to load billing settings");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        await refreshPreferences();
        toast.success("Billing Settings updated successfully!");
      } else {
        toast.error("Failed to update billing settings.");
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
      [name]: type === 'number' ? parseFloat(value) || 0 : value 
    });
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings({ ...settings, [name]: checked });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 pr-2 lg:pr-4">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Localization & Currency */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" /> Localization
            </CardTitle>
            <CardDescription>Configure currency used across the application.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Currency Code (e.g. USD, EUR, PKR)</Label>
                <Input name="Currency" value={settings.Currency} onChange={handleChange} placeholder="PKR" />
              </div>
              <div className="space-y-2">
                <Label>Currency Symbol</Label>
                <Input name="CurrencySymbol" value={settings.CurrencySymbol} onChange={handleChange} placeholder="Rs" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label className="text-sm text-slate-500">Quick Presets</Label>
              <Select 
                value={`${settings.Currency}|${settings.CurrencySymbol}`}
                onValueChange={(val) => {
                  const [cur, sym] = val.split('|');
                  setSettings({...settings, Currency: cur, CurrencySymbol: sym});
                }}
              >
                <SelectTrigger className="w-full md:w-1/2">
                  <SelectValue placeholder="Select Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR|Rs">PKR - Rs</SelectItem>
                  <SelectItem value="USD|$">USD - $</SelectItem>
                  <SelectItem value="SAR|﷼">SAR - ﷼</SelectItem>
                  <SelectItem value="EUR|€">EUR - €</SelectItem>
                  <SelectItem value="GBP|£">GBP - £</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-600" /> Financial & Discounts
            </CardTitle>
            <CardDescription>Manage global tax rates and maximum allowable discounts.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div>
                <Label className="text-base font-semibold">Enable Global Tax</Label>
                <p className="text-sm text-slate-500">Apply a default tax rate to all invoices.</p>
              </div>
              <Switch checked={settings.TaxEnabled} onCheckedChange={(c) => handleSwitchChange("TaxEnabled", c)} />
            </div>
            <div className={`space-y-2 transition-opacity ${!settings.TaxEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label>Default Tax Rate (%)</Label>
              <Input type="number" step="0.01" name="DefaultTaxRate" value={settings.DefaultTaxRate} onChange={handleChange} disabled={!settings.TaxEnabled} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border mt-6">
              <div>
                <Label className="text-base font-semibold">Enable Global Discounts</Label>
                <p className="text-sm text-slate-500">Allow cashiers to apply discounts on the POS screen.</p>
              </div>
              <Switch checked={settings.DiscountEnabled} onCheckedChange={(c) => handleSwitchChange("DiscountEnabled", c)} />
            </div>
            <div className={`space-y-2 transition-opacity ${!settings.DiscountEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label>Absolute Max Discount (%)</Label>
              <Input type="number" step="0.01" name="MaxDiscountPercentage" value={settings.MaxDiscountPercentage} onChange={handleChange} disabled={!settings.DiscountEnabled} />
              <p className="text-xs text-muted-foreground">The POS will physically prevent any discount above this percentage.</p>
            </div>
          </CardContent>
        </Card>

        {/* POS Security Rules */}
        <Card className="border-red-100 dark:border-red-900 shadow-sm">
          <CardHeader className="pb-4 border-b bg-red-50/50 dark:bg-red-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-700 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" /> POS Security Rules
            </CardTitle>
            <CardDescription>Enforce manager authorization for discounts and overrides.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div>
                <Label className="text-base font-semibold">Require Admin PIN for Discounts</Label>
                <p className="text-sm text-slate-500">Enforce PIN prompt when custom discounts exceed the threshold.</p>
              </div>
              <Switch checked={settings.RequireAdminPinForDiscount} onCheckedChange={(c) => handleSwitchChange("RequireAdminPinForDiscount", c)} />
            </div>
            <div className={`space-y-2 transition-opacity ${!settings.RequireAdminPinForDiscount ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label>Admin PIN Discount Threshold (%)</Label>
              <Input type="number" step="0.01" name="AdminDiscountThreshold" value={settings.AdminDiscountThreshold} onChange={handleChange} disabled={!settings.RequireAdminPinForDiscount} />
              <p className="text-xs text-muted-foreground">If a cashier attempts a discount greater than {settings.AdminDiscountThreshold}%, an Admin PIN will be required.</p>
            </div>
          </CardContent>
        </Card>

        {/* Invoicing & Behavior */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-600" /> POS Behavior & Invoicing
            </CardTitle>
            <CardDescription>Control how invoices are generated and standard POS behavior.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Invoice Number Prefix</Label>
                <Input name="InvoicePrefix" value={settings.InvoicePrefix} onChange={handleChange} placeholder="INV-" />
              </div>
              <div className="space-y-2">
                <Label>Next Invoice Number</Label>
                <Input type="number" name="NextInvoiceNumber" value={settings.NextInvoiceNumber} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default Payment Method</Label>
              <Select 
                value={settings.DefaultPaymentMethod} 
                onValueChange={(val) => setSettings({...settings, DefaultPaymentMethod: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Credit/Debit Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Auto-Print Receipt</Label>
                  <p className="text-xs text-slate-500">Instantly print upon save</p>
                </div>
                <Switch checked={settings.AutoPrintReceipt} onCheckedChange={(c) => handleSwitchChange("AutoPrintReceipt", c)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                <div>
                  <Label className="text-sm font-semibold">Keyboard Shortcuts</Label>
                  <p className="text-xs text-slate-500">Show shortcuts on POS</p>
                </div>
                <Switch checked={settings.ShowKeyboardShortcuts} onCheckedChange={(c) => handleSwitchChange("ShowKeyboardShortcuts", c)} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6 sticky top-0 self-start">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 pb-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Live System Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-sm">
            
            <div className="space-y-1">
              <p className="text-slate-500">Next Invoice Number:</p>
              <p className="text-xl font-bold font-mono tracking-tight text-primary">
                {settings.InvoicePrefix}{String(settings.NextInvoiceNumber).padStart(6, '0')}
              </p>
            </div>
            
            <div className="w-full h-[1px] bg-border" />
            
            <div className="space-y-1">
              <p className="text-slate-500">Sample Price Display:</p>
              <p className="text-lg font-bold">
                {settings.CurrencySymbol} 1,250.00 <span className="text-xs font-normal text-slate-500">({settings.Currency})</span>
              </p>
            </div>
            
            <div className="w-full h-[1px] bg-border" />
            
            <div className="space-y-2">
              <p className="text-slate-500">POS Rules Summary:</p>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Default Tax</span>
                  <span className="font-semibold">{settings.TaxEnabled ? `${settings.DefaultTaxRate}%` : "Disabled"}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Max Discount</span>
                  <span className="font-semibold">{settings.DiscountEnabled ? `${settings.MaxDiscountPercentage}%` : "Disabled"}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Admin PIN Trigger</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {settings.RequireAdminPinForDiscount ? `> ${settings.AdminDiscountThreshold}%` : "Off"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Default Payment</span>
                  <span className="font-semibold">{settings.DefaultPaymentMethod}</span>
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
