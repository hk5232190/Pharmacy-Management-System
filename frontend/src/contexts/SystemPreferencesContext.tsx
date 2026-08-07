"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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

interface SystemPreferencesContextType {
  preferences: SystemPreferences;
  refreshPreferences: () => Promise<void>;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatNumber: (value: number | null | undefined) => string;
}

const SystemPreferencesContext = createContext<SystemPreferencesContextType>({
  preferences: DEFAULT_SETTINGS,
  refreshPreferences: async () => {},
  formatDate: () => "",
  formatTime: () => "",
  formatNumber: () => "",
});

export function SystemPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<SystemPreferences>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchPreferences = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/appearance");
      if (res.ok) {
        const data = await res.json();
        setPreferences({ ...DEFAULT_SETTINGS, ...data });
      }
    } catch (e) {
      console.error("Failed to load system preferences", e);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    if (preferences.DateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
    if (preferences.DateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
    if (preferences.DateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    if (preferences.TimeFormat === "12h") {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${hoursStr}:${minutes} ${ampm}`;
    }
    
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes}`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return "0.00";

    if (preferences.NumberFormat === "1.234,56") {
      // European format
      return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    } else if (preferences.NumberFormat === "1 234.56") {
      // Space separated
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace(/,/g, '.');
    }
    // Default US/UK 1,234.56
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  return (
    <SystemPreferencesContext.Provider value={{
      preferences,
      refreshPreferences: fetchPreferences,
      formatDate,
      formatTime,
      formatNumber
    }}>
      {children}
    </SystemPreferencesContext.Provider>
  );
}

export const useSystemPreferences = () => useContext(SystemPreferencesContext);
