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
  const [isLoading, setIsLoading] = useState(false);
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
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-blue-700 dark:text-blue-400">
              <DollarSign className="w-5 h-5 drop-shadow-sm" /> Localization
            </CardTitle>
            <CardDescription className="text-slate-500 mt-1">Configure currency used across the application.</CardDescription>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Currency Code (e.g. USD, EUR, PKR)</Label>
                <Input name="Currency" value={settings.Currency} onChange={handleChange} placeholder="PKR" className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 transition-all shadow-sm" />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Currency Symbol</Label>
                <Input name="CurrencySymbol" value={settings.CurrencySymbol} onChange={handleChange} placeholder="Rs" className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 transition-all shadow-sm" />
              </div>
            </div>
            <div className="pt-2 space-y-3">
              <Label className="text-sm font-semibold text-slate-500">Quick Presets</Label>
              <Select 
                value={`${settings.Currency}|${settings.CurrencySymbol}`}
                onValueChange={(val) => {
                  const [cur, sym] = val.split('|');
                  setSettings({...settings, Currency: cur, CurrencySymbol: sym});
                }}
              >
                <SelectTrigger className="w-full md:w-1/2 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 transition-all shadow-sm">
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
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(16,185,129,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
              <Calculator className="w-5 h-5 drop-shadow-sm" /> Financial & Discounts
            </CardTitle>
            <CardDescription className="text-slate-500 mt-1">Manage global tax rates and maximum allowable discounts.</CardDescription>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            <div className="flex items-center justify-between p-5 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div>
                <Label className="text-base font-semibold">Enable Global Tax</Label>
                <p className="text-sm text-slate-500 mt-0.5">Apply a default tax rate to all invoices.</p>
              </div>
              <Switch checked={settings.TaxEnabled} onCheckedChange={(c) => handleSwitchChange("TaxEnabled", c)} />
            </div>
            <div className={`space-y-3 transition-opacity ${!settings.TaxEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label className="text-sm font-semibold">Default Tax Rate (%)</Label>
              <Input type="number" step="0.01" name="DefaultTaxRate" value={settings.DefaultTaxRate} onChange={handleChange} disabled={!settings.TaxEnabled} className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 transition-all shadow-sm" />
            </div>

            <div className="flex items-center justify-between p-5 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800 mt-8">
              <div>
                <Label className="text-base font-semibold">Enable Global Discounts</Label>
                <p className="text-sm text-slate-500 mt-0.5">Allow cashiers to apply discounts on the POS screen.</p>
              </div>
              <Switch checked={settings.DiscountEnabled} onCheckedChange={(c) => handleSwitchChange("DiscountEnabled", c)} />
            </div>
            <div className={`space-y-3 transition-opacity ${!settings.DiscountEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label className="text-sm font-semibold">Absolute Max Discount (%)</Label>
              <Input type="number" step="0.01" name="MaxDiscountPercentage" value={settings.MaxDiscountPercentage} onChange={handleChange} disabled={!settings.DiscountEnabled} className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 transition-all shadow-sm" />
              <p className="text-sm text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-2 block">
                The POS will physically prevent any discount above this percentage.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* POS Security Rules */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-red-200/60 dark:ring-red-900/50 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(239,68,68,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-red-100 dark:border-red-900/40 bg-gradient-to-r from-red-50/80 to-transparent dark:from-red-950/20 dark:to-transparent">
            <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-red-700 dark:text-red-400">
              <ShieldAlert className="w-5 h-5 drop-shadow-sm" /> POS Security Rules
            </CardTitle>
            <CardDescription className="text-slate-500 mt-1">Enforce manager authorization for discounts and overrides.</CardDescription>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            <div className="flex items-center justify-between p-5 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div>
                <Label className="text-base font-semibold">Require Admin PIN for Discounts</Label>
                <p className="text-sm text-slate-500 mt-0.5">Enforce PIN prompt when custom discounts exceed the threshold.</p>
              </div>
              <Switch checked={settings.RequireAdminPinForDiscount} onCheckedChange={(c) => handleSwitchChange("RequireAdminPinForDiscount", c)} />
            </div>
            <div className={`space-y-3 transition-opacity ${!settings.RequireAdminPinForDiscount ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label className="text-sm font-semibold">Admin PIN Discount Threshold (%)</Label>
              <Input type="number" step="0.01" name="AdminDiscountThreshold" value={settings.AdminDiscountThreshold} onChange={handleChange} disabled={!settings.RequireAdminPinForDiscount} className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-red-500/30 focus-visible:border-red-500 transition-all shadow-sm" />
              <p className="text-sm text-slate-500 font-medium bg-red-50/50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900 mt-2 block">
                If a cashier attempts a discount greater than {settings.AdminDiscountThreshold}%, an Admin PIN will be required.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Invoicing & Behavior */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
              <Settings2 className="w-5 h-5 drop-shadow-sm" /> POS Behavior & Invoicing
            </CardTitle>
            <CardDescription className="text-slate-500 mt-1">Control how invoices are generated and standard POS behavior.</CardDescription>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Invoice Number Prefix</Label>
                <Input name="InvoicePrefix" value={settings.InvoicePrefix} onChange={handleChange} placeholder="INV-" className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Next Invoice Number</Label>
                <Input type="number" name="NextInvoiceNumber" value={settings.NextInvoiceNumber} onChange={handleChange} className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Default Payment Method</Label>
              <Select 
                value={settings.DefaultPaymentMethod} 
                onValueChange={(val) => setSettings({...settings, DefaultPaymentMethod: val})}
              >
                <SelectTrigger className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm">
                  <SelectValue placeholder="Select default payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Credit/Debit Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-5 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div>
                  <Label className="text-base font-semibold">Auto-Print Receipt</Label>
                  <p className="text-sm text-slate-500 mt-0.5">Instantly print upon save</p>
                </div>
                <Switch checked={settings.AutoPrintReceipt} onCheckedChange={(c) => handleSwitchChange("AutoPrintReceipt", c)} />
              </div>
              <div className="flex items-center justify-between p-5 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div>
                  <Label className="text-base font-semibold">Keyboard Shortcuts</Label>
                  <p className="text-sm text-slate-500 mt-0.5">Show shortcuts on POS</p>
                </div>
                <Switch checked={settings.ShowKeyboardShortcuts} onCheckedChange={(c) => handleSwitchChange("ShowKeyboardShortcuts", c)} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6 sticky top-0 self-start">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 rounded-2xl">
          <CardHeader className="bg-slate-50/80 dark:bg-slate-900/40 pb-5 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Live System Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-7 space-y-7 text-sm">
            
            <div className="space-y-1">
              <p className="text-slate-500 font-medium">Next Invoice Number:</p>
              <p className="text-2xl font-black font-mono tracking-tight text-blue-600 dark:text-blue-400">
                {settings.InvoicePrefix}{String(settings.NextInvoiceNumber).padStart(6, '0')}
              </p>
            </div>
            
            <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800" />
            
            <div className="space-y-1">
              <p className="text-slate-500 font-medium">Sample Price Display:</p>
              <p className="text-xl font-bold">
                {settings.CurrencySymbol} 1,250.00 <span className="text-sm font-normal text-slate-400 ml-1">({settings.Currency})</span>
              </p>
            </div>
            
            <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800" />
            
            <div className="space-y-3">
              <p className="text-slate-500 font-medium">POS Rules Summary:</p>
              <ul className="space-y-3">
                <li className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Default Tax</span>
                  <span className="font-bold">{settings.TaxEnabled ? `${settings.DefaultTaxRate}%` : "Disabled"}</span>
                </li>
                <li className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Max Discount</span>
                  <span className="font-bold">{settings.DiscountEnabled ? `${settings.MaxDiscountPercentage}%` : "Disabled"}</span>
                </li>
                <li className="flex justify-between items-center bg-red-50/50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Admin PIN Trigger</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {settings.RequireAdminPinForDiscount ? `> ${settings.AdminDiscountThreshold}%` : "Off"}
                  </span>
                </li>
                <li className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Default Payment</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{settings.DefaultPaymentMethod}</span>
                </li>
              </ul>
            </div>
            
            <div className="pt-6">
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300 font-semibold text-base">
                {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

