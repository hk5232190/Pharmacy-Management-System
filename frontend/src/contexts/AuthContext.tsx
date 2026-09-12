"use client";
import { getApiBaseUrl } from "@/lib/api-client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { clearStoredTokens } from "@/lib/auth-session";

export interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  profile_photo_path: string | null;
  is_active: boolean;
  role: string;
}

const DEFAULT_USER: UserProfile = {
  id: 0,
  username: "Admin",
  email: null,
  is_active: true,
  full_name: "Admin",
  phone_number: "",
  profile_photo_path: null,
  role: "admin"
};

interface AuthContextType {
  user: UserProfile;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (accessToken: string) => Promise<UserProfile | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  loading: true,
  refreshUser: async () => {},
  login: async () => null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

async function fetchProfileByToken(token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.profile_photo_path) {
        data.profile_photo_path = `${data.profile_photo_path}?t=${new Date().getTime()}`;
      }
      return { ...DEFAULT_USER, ...data };
    }
    if (res.status === 401) {
      clearStoredTokens();
      return null;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) return;
    const profile = await fetchProfileByToken(token);
    if (profile) setUser(profile);
  }, []);

  const login = useCallback(async (accessToken: string): Promise<UserProfile | null> => {
    sessionStorage.setItem("access_token", accessToken);
    const profile = await fetchProfileByToken(accessToken);
    setUser(profile ? profile : DEFAULT_USER);
    setLoading(false);
    return profile;
  }, []);

  const logout = useCallback(() => {
    clearStoredTokens();
    setUser(DEFAULT_USER);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      const profile = await fetchProfileByToken(token);
      if (cancelled) return;
      if (profile) {
        setUser(profile);
      } else {
        setUser(DEFAULT_USER);
        clearStoredTokens();
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any external logout path (API 401, startup invalid token, session timeout)
  // broadcasts a reset so stale user/role state never leaks into the next login.
  useEffect(() => {
    const reset = () => {
      setUser(DEFAULT_USER);
      setLoading(false);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pms_auth_reset") reset();
    };
    window.addEventListener("pms-auth-reset", reset);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pms-auth-reset", reset);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}