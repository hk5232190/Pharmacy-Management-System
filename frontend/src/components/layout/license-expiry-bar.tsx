"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, ShieldX, AlertTriangle, Clock,
  RefreshCw, Key, X, Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LicenseInfo {
  status: "Active" | "Invalid" | "Missing" | "Error";
  remaining_days: number | null;
  is_lifetime: boolean;
  expiry_date: string | null;
}

type ExpiryLevel = "info" | "warning" | "urgent" | "critical";

interface ExpiryTier {
  level: ExpiryLevel;
  isDismissible: boolean;
  headline: string;
  Icon: React.ElementType;
  card: string;
  iconBg: string;
  iconFg: string;
  badge: string;
  renewBtn: string;
  viewBtn: string;
  dismissCls: string;
  headlineCls: string;
  pulse: boolean;
}

// ─── Tier derivation ─────────────────────────────────────────────────────────

function getExpiryTier(info: LicenseInfo): ExpiryTier | null {
  if (info.is_lifetime) return null;
  if (info.status !== "Active") return null;
  const days = info.remaining_days;
  if (days === null || days > 30) return null;

  const dayLabel = days <= 0 ? "today" : `in ${days} day${days !== 1 ? "s" : ""}`;

  if (days <= 3) {
    return {
      level: "critical",
      isDismissible: false,
      headline: `License expires ${dayLabel}`,
      Icon: ShieldX,
      card: "bg-gradient-to-r from-rose-600 via-rose-500 to-red-500 dark:from-rose-700 dark:via-rose-600 dark:to-red-600 border-rose-400/30 shadow-[0_4px_20px_rgba(225,29,72,0.30)]",
      iconBg: "bg-white/15",
      iconFg: "text-white",
      badge: "bg-white/20 text-white border-white/25",
      renewBtn: "bg-white text-rose-600 hover:bg-rose-50 shadow-sm",
      viewBtn: "bg-white/10 text-white hover:bg-white/20 border border-white/30",
      dismissCls: "",
      headlineCls: "text-white",
      pulse: true,
    };
  }

  if (days <= 7) {
    return {
      level: "urgent",
      isDismissible: true,
      headline: `License expires in ${days} days`,
      Icon: AlertTriangle,
      card: "bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-orange-950/70 dark:via-amber-950/50 dark:to-orange-950/70 border-orange-300/80 dark:border-orange-700/60 shadow-[0_4px_20px_rgba(234,88,12,0.15)]",
      iconBg: "bg-orange-100 dark:bg-orange-900/50",
      iconFg: "text-orange-600 dark:text-orange-400",
      badge: "bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300 border-orange-300/70 dark:border-orange-700/60",
      renewBtn: "bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-600/25",
      viewBtn: "text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-300 dark:border-orange-700",
      dismissCls: "text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40",
      headlineCls: "text-orange-900 dark:text-orange-100",
      pulse: false,
    };
  }

  if (days <= 15) {
    return {
      level: "warning",
      isDismissible: true,
      headline: `License expires in ${days} days`,
      Icon: ShieldAlert,
      card: "bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/70 dark:via-yellow-950/50 dark:to-amber-950/70 border-amber-300/80 dark:border-amber-700/60 shadow-[0_4px_20px_rgba(245,158,11,0.15)]",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconFg: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-300/70 dark:border-amber-700/60",
      renewBtn: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/25",
      viewBtn: "text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-700",
      dismissCls: "text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40",
      headlineCls: "text-amber-900 dark:text-amber-100",
      pulse: false,
    };
  }

  return {
    level: "info",
    isDismissible: true,
    headline: `License expires in ${days} days`,
    Icon: Clock,
    card: "bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/70 dark:via-indigo-950/50 dark:to-blue-950/70 border-blue-200/80 dark:border-blue-800/60 shadow-[0_4px_20px_rgba(37,99,235,0.12)]",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconFg: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-700/60",
    renewBtn: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/25",
    viewBtn: "text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-300 dark:border-blue-700",
    dismissCls: "text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40",
    headlineCls: "text-blue-900 dark:text-blue-100",
    pulse: false,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LicenseExpiryBar() {
  const router = useRouter();
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  // Single source of truth for dismiss — pure in-memory, resets on every login
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const fetchedRef = useRef(false);

  // Hydration guard
  useEffect(() => { setMounted(true); }, []);

  // Fetch license info once on mount
  const fetchInfo = useCallback(async () => {
    try {
      const res = await apiClient.get("/license/info");
      if (res && res.status) setInfo(res as LicenseInfo);
    } catch { /* fail silently */ }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchInfo();
    }
  }, [fetchInfo]);

  // Re-fetch and reset dismiss when a new license is imported
  useEffect(() => {
    const handler = () => { setDismissed(false); fetchInfo(); };
    window.addEventListener("license_renewed", handler);
    return () => window.removeEventListener("license_renewed", handler);
  }, [fetchInfo]);

  // Entrance slide-in animation
  useEffect(() => {
    if (mounted && info) {
      const t = setTimeout(() => setSlideIn(true), 60);
      return () => clearTimeout(t);
    }
  }, [mounted, info]);

  // ── Early exits ──
  if (!mounted) return null;
  if (dismissed) return null;   // X was clicked — immediately gone
  if (!info) return null;

  const tier = getExpiryTier(info);
  if (!tier) return null;

  const isCritical = tier.level === "critical";

  return (
    // print:hidden — never printed on receipts, invoices, or reports
    <div
      className={cn(
        "print:hidden w-full flex justify-center px-6 overflow-hidden",
        "transition-all duration-500 ease-out",
        slideIn ? "max-h-16 opacity-100 py-2" : "max-h-0 opacity-0 py-0"
      )}
    >
      <div
        className={cn(
          "w-full max-w-3xl flex items-center gap-3 px-4 py-2.5 rounded-2xl border",
          tier.card
        )}
      >
        {/* Icon */}
        <div className={cn(
          "relative shrink-0 w-8 h-8 rounded-xl flex items-center justify-center",
          tier.iconBg
        )}>
          {tier.pulse && (
            <span className="absolute inset-0 rounded-xl animate-ping bg-white/30" />
          )}
          <tier.Icon
            size={16}
            className={cn("relative z-10 shrink-0", tier.iconFg, isCritical && "animate-pulse")}
          />
        </div>

        {/* Headline + badge — flex-1 pushes buttons to the right */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn("text-sm font-bold whitespace-nowrap", tier.headlineCls)}>
            {tier.headline}
          </span>
          <span className={cn(
            "hidden sm:inline-flex items-center gap-1 text-[10px] font-bold",
            "px-2 py-0.5 rounded-full border tracking-wider uppercase whitespace-nowrap",
            tier.badge
          )}>
            {isCritical && <Zap size={8} className="shrink-0" />}
            {tier.level}
          </span>
        </div>

        {/* Divider */}
        <div className={cn("w-px h-4 shrink-0", isCritical ? "bg-white/25" : "bg-border")} />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => router.push("/dashboard/settings/license")}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg",
              "transition-colors duration-150 whitespace-nowrap",
              tier.renewBtn
            )}
          >
            <RefreshCw size={11} className="shrink-0" />
            Renew License
          </button>
          <button
            onClick={() => router.push("/dashboard/settings/license")}
            className={cn(
              "hidden sm:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg",
              "transition-colors duration-150 whitespace-nowrap",
              tier.viewBtn
            )}
          >
            <Key size={11} className="shrink-0" />
            View
          </button>
        </div>

        {/* Dismiss X — not rendered for critical tier (≤3 days / today) per SRS */}
        {tier.isDismissible && (
          <>
            <div className="w-px h-4 shrink-0 bg-border" />
            <button
              onClick={() => setDismissed(true)}
              className={cn(
                "shrink-0 p-1.5 rounded-lg transition-colors duration-150 group",
                tier.dismissCls
              )}
              title="Dismiss"
              aria-label="Dismiss license expiry warning"
            >
              <X size={13} className="transition-transform duration-150 group-hover:rotate-90" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
