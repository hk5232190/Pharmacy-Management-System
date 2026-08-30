"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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

interface InventorySettingsContextType {
  inventorySettings: InventorySettings;
  refreshInventorySettings: () => Promise<void>;
  isLoaded: boolean;
}

const InventorySettingsContext = createContext<InventorySettingsContextType>({
  inventorySettings: DEFAULT_SETTINGS,
  refreshInventorySettings: async () => {},
  isLoaded: false,
});

export function InventorySettingsProvider({ children }: { children: ReactNode }) {
  const [inventorySettings, setInventorySettings] = useState<InventorySettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/inventory");
      if (res.ok) {
        const data = await res.json();
        setInventorySettings({ ...DEFAULT_SETTINGS, ...data });
      }
    } catch (e) {
      console.error("Failed to load inventory settings", e);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <InventorySettingsContext.Provider value={{
      inventorySettings,
      refreshInventorySettings: fetchSettings,
      isLoaded
    }}>
      {children}
    </InventorySettingsContext.Provider>
  );
}

export const useInventorySettings = () => useContext(InventorySettingsContext);
