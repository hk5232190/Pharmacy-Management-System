"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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
}

const DEFAULT_PROFILE: PharmacyProfile = {
  PharmacyName: "Pharmacy",
  OwnerName: "", RegistrationNumber: "", DrugLicenseNumber: "",
  PhoneNumber: "", EmailAddress: "", Address: "", City: "", State: "",
  Country: "", PostalCode: "", Website: "", LogoPath: null
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
  const [profile, setProfile] = useState<PharmacyProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.LogoPath) {
          data.LogoPath = `${data.LogoPath}?t=${new Date().getTime()}`;
        }
        setProfile({ ...DEFAULT_PROFILE, ...data });
      }
    } catch (error) {
      console.error("Failed to fetch pharmacy profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, refreshProfile: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
