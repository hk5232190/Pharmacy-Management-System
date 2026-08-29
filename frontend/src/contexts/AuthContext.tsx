"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  profile_photo_path: string | null;
  is_active: boolean;
}

const DEFAULT_USER: UserProfile = {
  id: 0,
  username: "Admin",
  email: null,
  is_active: true,
  full_name: "Admin",
  phone_number: "",
  profile_photo_path: null
};

interface AuthContextType {
  user: UserProfile;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (!token) return;
      
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile_photo_path) {
          data.profile_photo_path = `${data.profile_photo_path}?t=${new Date().getTime()}`;
        }
        setUser({ ...DEFAULT_USER, ...data });
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
