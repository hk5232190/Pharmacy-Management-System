"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RefreshCw, Palette, Globe2, Volume2, Bell, LayoutDashboard, MonitorSmartphone, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";

interface SystemPreferences {
  SettingsId?: number;
  Theme: string;
  DateFormat: string;
  TimeFormat: string;
  NumberFormat: string;
  StartupModule: string;
  EnableAudioAlerts: boolean;
  EnableToastNotifications: boolean;
  Language: string;
}

const DEFAULT_SETTINGS: SystemPreferences = {
  Theme: "System Default",
  DateFormat: "DD/MM/YYYY",
  TimeFormat: "12h",
  NumberFormat: "1,234.56",
  StartupModule: "Dashboard",
  EnableAudioAlerts: true,
  EnableToastNotifications: true,
  Language: "English",
};

export default function AppearanceSettingsPage() {
  const [settings, setSettings] = useState<SystemPreferences>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { setTheme } = useTheme();
  const { refreshPreferences } = useSystemPreferences();

  useEffect(() => {
    fetchSettings();
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/appearance");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        toast.error("Failed to load system preferences");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("System Preferences updated successfully!");
        await refreshPreferences(); // Globally update the entire app instantly
      } else {
        toast.error("Failed to update system preferences.");
      }
    } catch (error) {
      toast.error("Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings({ ...settings, [name]: checked });
  };

  const handleSelectChange = (name: string, value: string) => {
    setSettings({ ...settings, [name]: value });
    if (name === "Theme") {
      if (value === "Light") setTheme("light");
      else if (value === "Dark") setTheme("dark");
      else setTheme("system");
    }
  };

  // Helper functions for the Live Preview
  const generatePreviewDate = () => {
    const d = currentDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    if (settings.DateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
    if (settings.DateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
    if (settings.DateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
  };

  const generatePreviewTime = () => {
    const d = currentDate;
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    if (settings.TimeFormat === "12h") {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${hoursStr}:${minutes} ${ampm}`;
    }
    
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes}`;
  };

  const generatePreviewNumber = () => {
    if (settings.NumberFormat === "1,234.56") return "14,250.00";
    if (settings.NumberFormat === "1.234,56") return "14.250,00";
    if (settings.NumberFormat === "1 234.56") return "14 250.00";
    return "14,250.00";
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
      {/* Left Column: Forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Display & Interface */}
        <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm">
          <CardHeader className="pb-4 border-b bg-indigo-50/50 dark:bg-indigo-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <Palette className="w-5 h-5" /> Display & Interface
            </CardTitle>
            <CardDescription>Global visual settings across the entire application.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            
            <div className="space-y-4 mb-8">
              <Label className="text-base font-semibold block mb-3">Color Theme</Label>
              <div className="grid grid-cols-3 gap-4">
                <div 
                  className={`border-2 rounded-xl p-4 cursor-pointer text-center flex flex-col items-center justify-center gap-2 transition-all ${settings.Theme === 'Light' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'}`}
                  onClick={() => handleSelectChange("Theme", "Light")}
                >
                  <Sun className={`w-8 h-8 ${settings.Theme === 'Light' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${settings.Theme === 'Light' ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>Light</span>
                </div>
                <div 
                  className={`border-2 rounded-xl p-4 cursor-pointer text-center flex flex-col items-center justify-center gap-2 transition-all ${settings.Theme === 'Dark' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'}`}
                  onClick={() => handleSelectChange("Theme", "Dark")}
                >
                  <Moon className={`w-8 h-8 ${settings.Theme === 'Dark' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${settings.Theme === 'Dark' ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>Dark</span>
                </div>
                <div 
                  className={`border-2 rounded-xl p-4 cursor-pointer text-center flex flex-col items-center justify-center gap-2 transition-all ${settings.Theme === 'System Default' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'}`}
                  onClick={() => handleSelectChange("Theme", "System Default")}
                >
                  <MonitorSmartphone className={`w-8 h-8 ${settings.Theme === 'System Default' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${settings.Theme === 'System Default' ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>System Default</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <Label>Startup Module</Label>
                <Select 
                  value={settings.StartupModule} 
                  onValueChange={(val) => handleSelectChange("StartupModule", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dashboard">Dashboard</SelectItem>
                    <SelectItem value="POS Terminal">POS Terminal</SelectItem>
                    <SelectItem value="Inventory">Inventory Management</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The page that loads immediately after login.</p>
              </div>
              <div className="space-y-2">
                <Label>Language (Future-Ready)</Label>
                <Select 
                  value={settings.Language} 
                  onValueChange={(val) => handleSelectChange("Language", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Urdu" disabled>Urdu (Coming Soon)</SelectItem>
                    <SelectItem value="Arabic" disabled>Arabic (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Global language localization.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional Formats */}
        <Card className="border-emerald-100 dark:border-emerald-900 shadow-sm">
          <CardHeader className="pb-4 border-b bg-emerald-50/50 dark:bg-emerald-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Globe2 className="w-5 h-5" /> Regional Formats
            </CardTitle>
            <CardDescription>Configure how dates, times, and financial numbers are rendered.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select 
                  value={settings.DateFormat} 
                  onValueChange={(val) => handleSelectChange("DateFormat", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (UK/Asia)</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Number Format</Label>
                <Select 
                  value={settings.NumberFormat} 
                  onValueChange={(val) => handleSelectChange("NumberFormat", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1,234.56">1,234.56 (Standard)</SelectItem>
                    <SelectItem value="1.234,56">1.234,56 (European)</SelectItem>
                    <SelectItem value="1 234.56">1 234.56 (Space separated)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" /> Notification Behavior
            </CardTitle>
            <CardDescription>Control how the system grabs your attention.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <Volume2 className="w-5 h-5 mt-0.5 text-slate-400" />
                <div>
                  <Label className="text-sm font-semibold">Enable Audio Alerts</Label>
                  <p className="text-xs text-slate-500">Play a sound when an error occurs or a sale is successfully processed.</p>
                </div>
              </div>
              <Switch checked={settings.EnableAudioAlerts} onCheckedChange={(c) => handleSwitchChange("EnableAudioAlerts", c)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <LayoutDashboard className="w-5 h-5 mt-0.5 text-slate-400" />
                <div>
                  <Label className="text-sm font-semibold">Enable Toast Popups</Label>
                  <p className="text-xs text-slate-500">Show non-intrusive popup notifications in the bottom corner of the screen.</p>
                </div>
              </div>
              <Switch checked={settings.EnableToastNotifications} onCheckedChange={(c) => handleSwitchChange("EnableToastNotifications", c)} />
            </div>

          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews & Actions */}
      <div className="space-y-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm sticky top-6">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 pb-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-600" /> Live Regional Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-6 shadow-inner">
              
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Transaction Date</p>
                <div className="text-2xl font-light text-slate-800 dark:text-white flex items-center justify-center gap-2">
                  {generatePreviewDate()}
                  <span className="text-lg text-slate-400">@</span>
                  {generatePreviewTime()}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800"></div>

              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Total Amount</p>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {generatePreviewNumber()}
                </div>
              </div>

            </div>

            <div className="pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 text-base shadow-sm">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
