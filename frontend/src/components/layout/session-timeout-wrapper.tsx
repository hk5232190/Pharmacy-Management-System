"use client";

import React, { useEffect, useState, useCallback } from "react";

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState<boolean | null>(null);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(120);
  const [jwtIat, setJwtIat] = useState<number | null>(null);
  const [jwtExp, setJwtExp] = useState<number | null>(null);

  // 1. Parse JWT on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        // claims are in seconds, convert to ms
        if (payload.iat) setJwtIat(payload.iat * 1000);
        if (payload.exp) setJwtExp(payload.exp * 1000);
      }
    }
  }, []);

  // 2. Fetch security settings to get dynamic timeout and re-parse JWT
  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (!token) return;
      
      // Re-parse token to get new iat/exp if token was refreshed
      const payload = parseJwt(token);
      if (payload) {
        if (payload.iat) setJwtIat(payload.iat * 1000);
        if (payload.exp) setJwtExp(payload.exp * 1000);
      }

      const res = await fetch("http://127.0.0.1:8000/api/v1/security/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessionTimeoutEnabled(data.SessionTimeoutEnabled);
        setSessionTimeoutMinutes(data.SessionTimeoutMinutes);
      }
    } catch (err) {
      console.error("Failed to fetch security settings", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Listen for cross-tab and local settings update broadcast
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "security_settings_updated") {
        fetchSettings(); // Re-fetch new settings to immediately apply new timeout
      }
    };
    const handleLocalChange = () => {
      fetchSettings();
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("security_settings_updated", handleLocalChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("security_settings_updated", handleLocalChange);
    };
  }, [fetchSettings]);

  // Execute Logout
  const executeLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    // Broadcast cross-tab logout
    localStorage.setItem("session_timeout_trigger", Date.now().toString());
    window.location.href = '/login?reason=session_expired';
  }, []);

  // Listen for cross-tab logout trigger
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "session_timeout_trigger") {
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("access_token");
        window.location.href = '/login?reason=session_expired';
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 3. Delta-based check to prevent setTimeout overflow
  useEffect(() => {
    if (sessionTimeoutEnabled === null) return; // Still loading settings
    if (!sessionTimeoutEnabled) return; // Disabled

    let absoluteExpiryMs = jwtExp;

    // If iat exists and we have dynamic minutes from settings, calculate exact dynamic expiry
    // This allows immediate invalidation if settings are shortened mid-session
    if (jwtIat && sessionTimeoutMinutes) {
      absoluteExpiryMs = jwtIat + (sessionTimeoutMinutes * 60 * 1000);
    }

    if (!absoluteExpiryMs) return;

    const checkExpiry = () => {
      if (Date.now() >= absoluteExpiryMs!) {
        executeLogout();
      }
    };

    // Immediate check on load
    checkExpiry();

    // Periodic delta interval every 10 seconds
    const intervalId = setInterval(checkExpiry, 10000);

    return () => clearInterval(intervalId);
  }, [sessionTimeoutEnabled, sessionTimeoutMinutes, jwtIat, jwtExp, executeLogout]);

  return <>{children}</>;
}
