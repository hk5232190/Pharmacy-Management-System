"use client";
import { getApiBaseUrl } from "@/lib/api-client";

import React, { createContext, useContext, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";

export interface PharmacyProfile {
  ProfileId?: number;
  PharmacyName: string;
  OwnerName: string;
  RegistrationNumber: string;
  DrugLicenseNumber: string;
  PhoneNumber: string;
  EmailAddress: string;
  Address: string;
  City: string;
  State: string;
  Country: string;
  PostalCode: string;
  Website: string;
  LogoPath: string | null;
  ReceiptLogoPath: string | null;
  ReceiptFooter1: string;
  ReceiptFooter2: string;
}

const DEFAULT_PROFILE: PharmacyProfile = {
  PharmacyName: "Pharmacy",
  OwnerName: "", RegistrationNumber: "", DrugLicenseNumber: "",
  PhoneNumber: "", EmailAddress: "", Address: "", City: "", State: "",
  Country: "", PostalCode: "", Website: "", LogoPath: null, ReceiptLogoPath: null,
  ReceiptFooter1: "Thank you for your visit!",
  ReceiptFooter2: "Software provided by Eagle Nest Creations"
};

interface ProfileContextType {
  profile: PharmacyProfile;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: DEFAULT_PROFILE,
  isLoading: true,
  refreshProfile: async () => {},
});

export const useProfile = () => useContext(ProfileContext);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const fetcher = async (url: string) => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
    const res = await fetch(url, {
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to fetch profile");
    return res.json();
  };

  const { data, error, mutate } = useSWR(`${getApiBaseUrl()}/settings/printer`, fetcher);

  const isLoading = !data && !error;
  let profile = DEFAULT_PROFILE;

  if (data) {
    const mappedData = {
        PharmacyName: data.PharmacyName || "Pharmacy",
        OwnerName: "",
        RegistrationNumber: "",
        DrugLicenseNumber: data.DrugLicenseNumber || "",
        PhoneNumber: data.PharmacyPhone || "",
        EmailAddress: "",
        Address: data.PharmacyAddress || "",
        City: "",
        State: "",
        Country: "",
        PostalCode: "",
        Website: data.Website || "",
        LogoPath: data.ReceiptLogoPath ? `${getApiBaseUrl().replace("/api/v1", "")}${data.ReceiptLogoPath.startsWith('/') ? data.ReceiptLogoPath : '/' + data.ReceiptLogoPath}?t=${new Date().getTime()}` : null,
        ReceiptLogoPath: data.ReceiptLogoPath ? `${getApiBaseUrl().replace("/api/v1", "")}${data.ReceiptLogoPath.startsWith('/') ? data.ReceiptLogoPath : '/' + data.ReceiptLogoPath}?t=${new Date().getTime()}` : null,
        ReceiptFooter1: data.ReceiptFooterMessage || "Thank you for your visit!",
        ReceiptFooter2: ""
    };
    profile = { ...DEFAULT_PROFILE, ...mappedData };
  }

  const refreshProfile = async () => {
    await mutate();
  };

  useEffect(() => {
    const handleProfileUpdate = () => {
      mutate();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, [mutate]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
