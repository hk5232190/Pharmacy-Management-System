"use client";
import { getApiBaseUrl } from "@/lib/api-client";
import { createContext, useContext, ReactNode } from "react";
import useSWR from "swr";

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
  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  const { data, error, mutate } = useSWR(`${getApiBaseUrl()}/settings/inventory`, fetcher);

  const isLoaded = data !== undefined || error !== undefined;
  const inventorySettings = data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;

  const fetchSettings = async () => {
    await mutate();
  };

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
