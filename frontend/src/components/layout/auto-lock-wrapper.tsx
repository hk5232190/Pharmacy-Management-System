"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Unlock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AutoLockWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const [isLocked, setIsLocked] = useState(false);
  
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        if (!token) return;
        const res = await fetch("http://127.0.0.1:8000/api/v1/security/settings", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setEnabled(data.AutoLockEnabled);
          setMinutes(data.AutoLockMinutes);
        }
      } catch (err) {
        console.error("Failed to fetch security settings", err);
      }
    };
    fetchSettings();
  }, []);

  const logAuditEvent = async (event: string, description: string) => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (!token) return;
      await fetch("http://127.0.0.1:8000/api/v1/security/audit-log", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ event, description })
      });
    } catch (e) {
      console.error("Audit log failed", e);
    }
  };

  // Sync state from localStorage (run immediately on mount)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const locked = localStorage.getItem("is_screen_locked") === "true";
    if (locked) {
      setIsLocked(true);
    }
  }, []);

  // Update overflow hidden when locked
  useEffect(() => {
    if (isLocked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isLocked]);

  const lockScreen = useCallback(() => {
    if (!isLocked) {
      setIsLocked(true);
      localStorage.setItem("is_screen_locked", "true");
      logAuditEvent("SCREEN_LOCKED", "Screen automatically locked due to inactivity");
    }
  }, [isLocked]);

  const updateActivity = useCallback(() => {
    if (isLocked) return;
    const now = Date.now().toString();
    localStorage.setItem("last_active_timestamp", now);
  }, [isLocked]);

  // Check activity interval
  useEffect(() => {
    if (!enabled || isLocked) return;

    const checkInterval = setInterval(() => {
      const lastActive = parseInt(localStorage.getItem("last_active_timestamp") || "0", 10);
      const now = Date.now();
      const elapsed = now - lastActive;
      
      if (elapsed > minutes * 60 * 1000) {
        lockScreen();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, [enabled, minutes, isLocked, lockScreen]);

  // Throttled activity listeners
  useEffect(() => {
    if (!enabled || isLocked) return;

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (!throttleTimeout) {
        updateActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 2000); // Throttle activity updates to once every 2 seconds
      }
    };

    // Initialize activity on mount
    updateActivity();

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [enabled, isLocked, updateActivity]);

  // Multi-tab sync via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "is_screen_locked") {
        if (e.newValue === "true") {
          setIsLocked(true);
        } else if (e.newValue === "false") {
          setIsLocked(false);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Prevent escape dismissal of focus trap
  useEffect(() => {
    if (!isLocked) return;
    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", blockEscape, { capture: true });
    return () => window.removeEventListener("keydown", blockEscape, { capture: true });
  }, [isLocked]);

  // Handle password unlock
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setUnlocking(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", user.username);
      formData.append("password", password);

      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        // Update token just in case
        if (localStorage.getItem("access_token")) {
          localStorage.setItem("access_token", data.access_token);
        } else {
          sessionStorage.setItem("access_token", data.access_token);
        }
        
        setPassword("");
        setIsLocked(false);
        localStorage.setItem("is_screen_locked", "false");
        updateActivity();
        logAuditEvent("SCREEN_UNLOCKED", "Screen unlocked successfully by user");
      } else {
        setError("Incorrect password");
      }
    } catch (err) {
      setError("An error occurred during verification");
    } finally {
      setUnlocking(false);
    }
  };

  // Render children normally if not locked
  return (
    <>
      {children}
      
      {isLocked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-md p-10 bg-white dark:bg-slate-950 rounded-3xl shadow-[0_0_80px_-15px_rgba(0,0,0,0.5)] border border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center transform transition-all animate-in zoom-in-95 duration-500 overflow-hidden">
            
            {/* Premium background glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center mb-6 ring-4 ring-slate-50 dark:ring-slate-900 shadow-xl overflow-hidden bg-gradient-to-tr from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
              {user.profile_photo_path ? (
                <img src={`http://127.0.0.1:8000${user.profile_photo_path}`} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Lock className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              )}
              {/* Green online dot */}
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full shadow-sm" />
            </div>
            
            <h2 className="relative z-10 text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Session Locked</h2>
            <p className="relative z-10 text-slate-500 dark:text-slate-400 text-center mb-8 text-sm px-4">
              Your workspace was locked to protect your data. Enter password for <span className="font-semibold text-slate-900 dark:text-slate-200">{user.username}</span> to resume.
            </p>

            <form onSubmit={handleUnlock} className="relative z-10 w-full space-y-5">
              <div className="space-y-2">
                <div className="relative group">
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 px-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                    autoFocus
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                </div>
                {error && (
                  <p className="text-sm text-red-500 font-medium flex items-center gap-1.5 mt-1 animate-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </p>
                )}
              </div>
              
              <Button type="submit" disabled={unlocking} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 transition-all duration-200">
                {unlocking ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  <><Unlock className="w-5 h-5 mr-2" /> Unlock Workspace</>
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
