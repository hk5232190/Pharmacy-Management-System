"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  User, Lock, Eye, EyeOff, Key, Shield, Plus,
  Receipt, Package, WifiOff, AlertTriangle
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState({
    LoginBrandingName: "PMS Software",
    LoginSubheading: "Pharmacy Management System",
    LoginBackgroundPath: null as string | null
  });

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/v1/settings/general")
      .then(res => res.json())
      .then(data => {
        if (data && !data.detail) {
          setBranding({
            LoginBrandingName: data.LoginBrandingName || "PMS Software",
            LoginSubheading: data.LoginSubheading || "Pharmacy Management System",
            LoginBackgroundPath: data.LoginBackgroundPath || null
          });
        }
      })
      .catch(err => console.error("Failed to load branding:", err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      // OAuth2PasswordRequestForm expects form data

      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Hydrate the authenticated profile before navigating so the app shell
      // renders the correct role from the very first frame (no admin flash).
      const profile = await login(data.access_token);
      if (profile && profile.role === "cashier") {
        router.push("/dashboard/sales");
      } else {
        router.push("/dashboard");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        overflow: "auto",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >

      {/* ════════════════════════════════════════
          LEFT PANEL — Vibrant Blue Hero
      ════════════════════════════════════════ */}
      <div
        className="login-left-panel"
        style={{
          display: "none",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1352a8",
          flex: "1 1 48%",
          minWidth: 340,
          minHeight: "100vh",
        }}
      >

        {/* Clean pharmacy background — no baked text */}
        <img
          src={
            branding.LoginBackgroundPath
              ? `http://127.0.0.1:8000${branding.LoginBackgroundPath}`
              : "/images/pharmacy_bg.jpg"
          }
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "right center",
            zIndex: 0,
          }}
        />

        {/* Subtle blue tint overlay — left side darker for text legibility */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(15,52,140,0.82) 0%, rgba(15,52,140,0.72) 40%, rgba(15,52,140,0.45) 70%, rgba(15,52,140,0.20) 100%)",
            zIndex: 1,
          }}
        />

        {/* ── Foreground content ── */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: "100vh",
          }}
        >

          <div style={{ padding: "clamp(20px, 3vh, 36px) clamp(24px, 4vw, 48px) 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Standalone white cross — no box */}
              <Plus size={34} color="#ffffff" strokeWidth={3} style={{ flexShrink: 0 }} />
              {/* Wordmark */}
              <div>
                <div
                  style={{
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "clamp(15px, 1.55vw, 22px)",
                    letterSpacing: "0.09em",
                    lineHeight: 1,
                  }}
                >
                  PHARMACY
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.80)",
                    fontWeight: 500,
                    fontSize: "clamp(9px, 0.72vw, 11px)",
                    letterSpacing: "0.20em",
                    marginTop: 3,
                  }}
                >
                  MANAGEMENT SYSTEM
                </div>
              </div>
            </div>
          </div>

          {/* ── MIDDLE: Headline + Subtext ── */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 clamp(24px, 4vw, 48px) clamp(48px, 7vh, 80px)" }}>
            <div style={{ maxWidth: 400 }}>
              <h1
                style={{
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: "clamp(30px, 3.4vw, 48px)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.6px",
                  marginBottom: "clamp(14px, 1.8vh, 22px)",
                  textShadow: "0 2px 16px rgba(0,0,0,0.30)",
                }}
              >
                Pharmacy<br />Management,<br />Simplified.
              </h1>
              <p
                style={{
                  color: "rgba(255,255,255,0.90)",
                  fontSize: "clamp(13px, 1.1vw, 16px)",
                  lineHeight: 1.68,
                  fontWeight: 400,
                  textShadow: "0 1px 8px rgba(0,0,0,0.22)",
                }}
              >
                Manage billing, inventory and purchases<br />
                from one simple desktop application.
              </p>
            </div>
          </div>

          {/* ── BOTTOM: Feature badges + footer ── */}
          <div>
            {/* Feature badges row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "6px 0",
                padding: "0 clamp(24px, 4vw, 48px) clamp(14px, 2.5vh, 26px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, paddingRight: 18, color: "rgba(255,255,255,0.95)", fontSize: "clamp(12px, 0.95vw, 14px)", fontWeight: 600 }}>
                <Receipt size={16} strokeWidth={1.7} />
                Fast Billing
              </div>
              <div style={{ width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.40)", marginRight: 18 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7, paddingRight: 18, color: "rgba(255,255,255,0.95)", fontSize: "clamp(12px, 0.95vw, 14px)", fontWeight: 600 }}>
                <Package size={16} strokeWidth={1.7} />
                Smart Inventory
              </div>
              <div style={{ width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.40)", marginRight: 18 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,0.95)", fontSize: "clamp(12px, 0.95vw, 14px)", fontWeight: 600 }}>
                <WifiOff size={16} strokeWidth={1.7} />
                Works Offline
              </div>
            </div>

            {/* Footer bar */}
            <div
              style={{
                backgroundColor: "rgba(5,18,55,0.85)",
                padding: "clamp(10px, 1.5vh, 14px) clamp(24px, 4vw, 48px)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p style={{ color: "rgba(255,255,255,0.70)", fontSize: "clamp(12px, 0.88vw, 13px)", fontWeight: 500 }}>
                © {new Date().getFullYear()} {branding.LoginBrandingName}
              </p>
              <p style={{ color: "rgba(255,255,255,0.60)", fontSize: "clamp(12px, 0.88vw, 13px)", fontWeight: 500 }}>
                Version 1.0.0
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════
          RIGHT PANEL — Auth Card
      ════════════════════════════════════════ */}
      <div
        style={{
          flex: "1 1 52%",
          minWidth: 320,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          backgroundColor: "#ffffff",
          padding: "clamp(24px, 4vh, 48px) clamp(16px, 3vw, 40px)",
        }}
      >

        {/* Auth Card */}
        <div style={{ width: "100%", maxWidth: 420, minWidth: 300 }}>
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: "clamp(36px, 5.5vh, 62px) clamp(28px, 3.5vw, 40px) clamp(36px, 5vh, 56px)",
              boxShadow:
                "0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.08), 0 16px 48px rgba(15,23,42,0.12)",
              border: "1px solid #dde3ed",
            }}
          >

            {/* ── Card Header ── */}
            <div style={{ textAlign: "center", marginBottom: "clamp(18px, 3vh, 32px)" }}>
              <h2
                style={{
                  fontSize: "clamp(22px, 2.4vw, 32px)",
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.4px",
                  marginBottom: 7,
                }}
              >
                Welcome Back
              </h2>
              <p
                style={{
                  fontSize: "clamp(13px, 1.05vw, 15.5px)",
                  color: "#2563eb",
                  fontWeight: 500,
                }}
              >
                {branding.LoginSubheading}
              </p>
            </div>

            {/* ── Login Form ── */}
            <form
              onSubmit={handleLogin}
              style={{ display: "flex", flexDirection: "column", gap: "clamp(14px, 2vh, 22px)" }}
            >

              {/* Error banner */}
              {error && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: "clamp(11px, 0.85vw, 13px)",
                    color: "#dc2626",
                    fontWeight: 500,
                  }}
                >
                  {error}
                </div>
              )}

              {/* ── Username ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label
                  htmlFor="username"
                  style={{ fontSize: "clamp(13px, 0.95vw, 14px)", fontWeight: 600, color: "#334155" }}
                >
                  Username
                </label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <User size={17} color="#9ca3af" strokeWidth={2} />
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#2563eb] placeholder:text-[#b0bac9]"
                    style={{
                      height: "clamp(42px, 5.2vh, 52px)",
                      paddingLeft: 42,
                      paddingRight: 14,
                      fontSize: "clamp(13px, 0.95vw, 14.5px)",
                      color: "#111827",
                      backgroundColor: "#f8fafc",
                      border: "1.5px solid #d1d5db",
                      borderRadius: 10,
                      boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
                    }}
                  />
                </div>
              </div>

              {/* ── Password ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label
                  htmlFor="password"
                  style={{ fontSize: "clamp(13px, 0.95vw, 14px)", fontWeight: 600, color: "#334155" }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Lock size={17} color="#9ca3af" strokeWidth={2} />
                  </span>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setIsCapsLockOn(e.getModifierState("CapsLock"))}
                    onKeyUp={(e) => setIsCapsLockOn(e.getModifierState("CapsLock"))}
                    onFocus={(e) => {
                      // Detect Caps Lock state on field focus
                      const ev = e.nativeEvent as unknown as KeyboardEvent;
                      if (typeof ev.getModifierState === "function") {
                        setIsCapsLockOn(ev.getModifierState("CapsLock"));
                      }
                    }}
                    required
                    disabled={isLoading}
                    className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#2563eb] placeholder:text-[#b0bac9]"
                    style={{
                      height: "clamp(42px, 5.2vh, 52px)",
                      paddingLeft: 42,
                      paddingRight: 46,
                      fontSize: "clamp(13px, 0.95vw, 14.5px)",
                      color: "#111827",
                      backgroundColor: "#f8fafc",
                      border: isCapsLockOn ? "1.5px solid #f59e0b" : "1.5px solid #d1d5db",
                      borderRadius: 10,
                      boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
                      transition: "border-color 0.15s",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                      color: "#9ca3af",
                      transition: "color 0.15s",
                    }}
                    className="hover:text-slate-600"
                  >
                    {showPassword
                      ? <EyeOff size={18} strokeWidth={2} />
                      : <Eye size={18} strokeWidth={2} />
                    }
                  </button>
                </div>
              </div>

              {/* ── Caps Lock Warning ── */}
              {isCapsLockOn && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fcd34d",
                    borderRadius: 8,
                    padding: "9px 13px",
                    fontSize: "clamp(11px, 0.85vw, 13px)",
                    color: "#92400e",
                    fontWeight: 500,
                    marginTop: -6,
                  }}
                >
                  <AlertTriangle size={15} color="#d97706" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  Caps Lock is ON — your password may be entered incorrectly.
                </div>
              )}

              {/* ── Login Button ── */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  height: "clamp(42px, 5.5vh, 52px)",
                  backgroundColor: isLoading ? "#3b82f6" : "#2563eb",
                  color: "#ffffff",
                  fontSize: "clamp(13px, 1vw, 16px)",
                  fontWeight: 700,
                  borderRadius: 10,
                  border: "none",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(37,99,235,0.32)",
                  transition: "background-color 0.15s, box-shadow 0.15s, transform 0.1s",
                  marginTop: 4,
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={e => {
                  if (!isLoading) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1d4ed8";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(37,99,235,0.42)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isLoading) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2563eb";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(37,99,235,0.32)";
                  }
                }}
                onMouseDown={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.99)";
                }}
                onMouseUp={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                }}
              >
                {isLoading ? "Authenticating..." : "Login"}
              </button>

              {/* ── Or Divider ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  margin: "2px 0",
                }}
              >
                <div style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
                <span
                  style={{
                    padding: "0 16px",
                    fontSize: "clamp(11px, 0.85vw, 13px)",
                    color: "#9ca3af",
                    fontWeight: 500,
                    backgroundColor: "#ffffff",
                  }}
                >
                  or
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
              </div>

              {/* ── Activate License Button ── */}
              <button
                type="button"
                onClick={() => window.location.href = "/activate"}
                style={{
                  width: "100%",
                  height: "clamp(42px, 5.5vh, 52px)",
                  backgroundColor: "#ffffff",
                  color: "#2563eb",
                  fontSize: "clamp(13px, 1vw, 16px)",
                  fontWeight: 600,
                  borderRadius: 10,
                  border: "1.5px solid #bfdbfe",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background-color 0.15s, border-color 0.15s",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#eff6ff";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#93c5fd";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ffffff";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#bfdbfe";
                }}
              >
                <Key size={17} strokeWidth={2.5} />
                Activate License
              </button>

            </form>
          </div>
        </div>

        {/* ── System Secure Badge ── */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "rgba(255,255,255,0.90)",
            backdropFilter: "blur(8px)",
            border: "1px solid #bbf7d0",
            borderRadius: 999,
            padding: "6px 14px 6px 10px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}
        >
          <Shield size={15} color="#16a34a" strokeWidth={2.5} />
          <span
            style={{
              fontSize: "clamp(11px, 0.85vw, 13px)",
              fontWeight: 700,
              color: "#16a34a",
            }}
          >
            System Secure
          </span>
        </div>

      </div>

      {/* ════════════════════════════════════════
          Responsive CSS — left panel visibility
      ════════════════════════════════════════ */}
      <style>{`
        @media (min-width: 1024px) {
          .login-left-panel {
            display: flex !important;
            flex-direction: column;
          }
        }
        @media (max-width: 1023px) {
          .login-left-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
