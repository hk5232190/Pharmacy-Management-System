"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RefreshCw, Volume2, Bell, LayoutDashboard } from "lucide-react";
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
  const { setTheme } = useTheme();
  const { refreshPreferences } = useSystemPreferences();

  useEffect(() => {
    fetchSettings();
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


  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">



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

            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-4">
              <Button variant="ghost" onClick={() => fetchSettings()} disabled={isSaving} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium">
                Cancel Changes
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="h-10 px-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 font-medium">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>

          </CardContent>
        </Card>
    </div>
  );
}
