"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, Cpu, Key, FileText,
  Upload, Copy, Check, RefreshCw, AlertTriangle, CheckCircle2, XCircle, X,
  Infinity, Info, Loader2, HardDrive, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LicenseInfo {
  status: "Active" | "Invalid" | "Missing" | "Error";
  validation_message: string;
  license_type: string | null;
  activation_date: string | null;
  expiry_date: string | null;
  remaining_days: number | null;
  /** Total subscription span in days (activation → expiry). Null for lifetime. */
  total_days: number | null;
  client_name: string | null;
  /** Active pharmacy name from DB — used as Client / Licensee display value. */
  pharmacy_name: string | null;
  license_id: string | null;
  hardware_id: string;
  key_reference: string;
  is_lifetime: boolean;
  license_file_info: {
    size_bytes?: number;
    last_modified?: string;
    file_name?: string;
    file_path?: string;
  };
}

interface ValidationChecks {
  file_exists: boolean;
  signature_valid: boolean;
  hardware_match: boolean;
  not_expired: boolean;
  overall_status: "PASSED" | "FAILED";
  error_message: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; label: string; cls: string }> = {
    Active:  { icon: ShieldCheck,  label: "Active",  cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
    Invalid: { icon: ShieldAlert,  label: "Invalid", cls: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800" },
    Missing: { icon: ShieldX,      label: "Missing", cls: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
    Error:   { icon: AlertTriangle, label: "Error",  cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700" },
  };
  const cfg = map[status] || map.Error;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border", cfg.cls)}>
      <Icon size={13} /> {cfg.label}
    </span>
  );
}

function InfoRow({ label, value, mono = false, children }: { label: string; value?: string | null; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0 gap-4">
      <span className="text-sm text-muted-foreground font-medium shrink-0">{label}</span>
      {children ?? (
        <span className={cn("text-sm font-semibold text-foreground text-right", mono && "font-mono text-xs")}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      {ok
        ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
        : <XCircle size={18} className="text-rose-500 shrink-0" />}
      <span className={cn("text-sm font-medium", ok ? "text-foreground" : "text-rose-600 dark:text-rose-400")}>
        {label}
      </span>
    </div>
  );
}

// ─── Status tier helpers ──────────────────────────────────────────────────────

type StatusTier = "active" | "warning" | "danger" | "lifetime";

function getStatusTier(
  status: string,
  remaining: number | null,
  isLifetime: boolean,
): StatusTier {
  if (isLifetime) return "lifetime";
  if (status === "Active") {
    return remaining !== null && remaining <= 14 ? "warning" : "active";
  }
  return "danger";
}

const TIER_STYLES: Record<StatusTier, {
  banner: string; icon: string; iconFg: string;
  bar: string; track: string; days: string;
  shield: any;
}> = {
  active: {
    banner: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
    icon:   "bg-emerald-100 dark:bg-emerald-900/40",
    iconFg: "text-emerald-600 dark:text-emerald-400",
    bar:    "bg-emerald-500",
    track:  "bg-emerald-100 dark:bg-emerald-900/40",
    days:   "text-emerald-600 dark:text-emerald-400",
    shield: ShieldCheck,
  },
  warning: {
    banner: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    icon:   "bg-amber-100 dark:bg-amber-900/40",
    iconFg: "text-amber-600 dark:text-amber-400",
    bar:    "bg-amber-500",
    track:  "bg-amber-100 dark:bg-amber-900/40",
    days:   "text-amber-600 dark:text-amber-400",
    shield: ShieldAlert,
  },
  danger: {
    banner: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800",
    icon:   "bg-rose-100 dark:bg-rose-900/40",
    iconFg: "text-rose-600 dark:text-rose-400",
    bar:    "bg-rose-500",
    track:  "bg-rose-100 dark:bg-rose-900/40",
    days:   "text-rose-600 dark:text-rose-400",
    shield: ShieldAlert,
  },
  lifetime: {
    banner: "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800",
    icon:   "bg-violet-100 dark:bg-violet-900/40",
    iconFg: "text-violet-600 dark:text-violet-400",
    bar:    "bg-violet-500",
    track:  "bg-violet-100 dark:bg-violet-900/40",
    days:   "text-violet-600 dark:text-violet-400",
    shield: ShieldCheck,
  },
};

// ─── Subscription Progress Bar ────────────────────────────────────────────────

function SubscriptionProgressBar({
  totalDays, remainingDays, tier,
}: { totalDays: number | null; remainingDays: number | null; tier: StatusTier }) {
  // Strict guards: no calculation if lifetime, total_days missing/zero, or remaining unknown
  if (tier === "lifetime" || totalDays === null || totalDays <= 0 || remainingDays === null) {
    return null;
  }
  const usedDays = Math.max(0, totalDays - remainingDays);
  // Clamp strictly between 0 and 100 — prevents rendering errors from bad data
  const pct = Math.min(100, Math.max(0, (usedDays / totalDays) * 100));
  const styles = TIER_STYLES[tier];
  return (
    <div className="mt-3 space-y-1.5">
      <div className={cn("h-2.5 w-full rounded-full overflow-hidden", styles.track)}>
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", styles.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground font-medium">
        <span>{usedDays} day{usedDays !== 1 ? "s" : ""} used</span>
        <span>{remainingDays} day{remainingDays !== 1 ? "s" : ""} remaining</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LicensePage() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [validation, setValidation] = useState<ValidationChecks | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Key reference reveal state
  const [showKey, setShowKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInfo();
    handleValidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInfo = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/license/info");
      setInfo(res);
      // Reset reveal state whenever license info is refreshed
      setRevealedKey(null);
      setShowKey(false);
    } catch {
      toast.error("Failed to load license information.");
    } finally {
      setLoading(false);
    }
  };

  /** Toggle key visibility — fetches full key from authenticated endpoint on first reveal */
  const handleToggleKey = useCallback(async () => {
    if (showKey) { setShowKey(false); return; }
    if (revealedKey !== null) { setShowKey(true); return; }
    setRevealLoading(true);
    try {
      const res = await apiClient.get("/license/key-reference");
      setRevealedKey(res.key_reference ?? null);
      setShowKey(true);
    } catch {
      toast.error("Could not reveal key reference. Please ensure you are logged in.");
    } finally {
      setRevealLoading(false);
    }
  }, [showKey, revealedKey]);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await apiClient.post("/license/validate", {});
      setValidation(res);
      if (res.overall_status === "PASSED") {
        toast.success("License passed all validation checks.");
      } else {
        toast.error("License validation failed. See details below.");
      }
    } catch {
      toast.error("Validation request failed.");
    } finally {
      setValidating(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!file.name.endsWith(".lic")) {
      toast.error("Only .lic files are accepted.");
      return;
    }
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/license/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || ""}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("New license imported and activated successfully!");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchInfo();
        await handleValidate();
      } else {
        toast.error(data.detail || "Import failed. Invalid license file.");
      }
    } catch {
      toast.error("Network error during import.");
    } finally {
      setImporting(false);
    }
  };

  const copyToClipboard = (text: string, type: "hwid" | "key") => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === "hwid") {
        setCopiedHwid(true);
        setTimeout(() => setCopiedHwid(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    });
  };

  const remainingColor = (days: number | null) => {
    if (days === null) return "text-primary";
    if (days <= 14) return "text-rose-600 dark:text-rose-400";
    if (days <= 30) return "text-orange-600 dark:text-orange-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading license information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">License Information</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View, validate, and manage your PMS software license.
          </p>
        </div>
      </div>

      {/* ── Status Banner (dynamic tier coloring + subscription progress bar) ── */}
      {(() => {
        const tier = getStatusTier(
          info?.status ?? "Error",
          info?.remaining_days ?? null,
          info?.is_lifetime ?? false,
        );
        const ts = TIER_STYLES[tier];
        const ShieldIcon = ts.shield;
        return (
          <div className={cn("rounded-2xl border p-5", ts.banner)}>
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", ts.icon)}>
                <ShieldIcon size={28} className={ts.iconFg} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-lg text-foreground">License Status</h3>
                  <StatusBadge status={info?.status || "Error"} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{info?.validation_message}</p>
                {/* Progress bar — strict guards applied inside component */}
                <SubscriptionProgressBar
                  totalDays={info?.total_days ?? null}
                  remainingDays={info?.remaining_days ?? null}
                  tier={tier}
                />
              </div>
              {/* Right-side counter or perpetual badge */}
              {info?.is_lifetime ? (
                <div className="shrink-0 text-right flex flex-col items-center gap-1">
                  <Infinity size={32} className={ts.iconFg} />
                  <div className="text-xs text-muted-foreground font-semibold">Perpetual</div>
                </div>
              ) : info?.status === "Active" && info.remaining_days !== null ? (
                <div className="shrink-0 text-right">
                  <div className={cn("text-3xl font-black tabular-nums", ts.days)}>
                    {info.remaining_days}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">days remaining</div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── License Details ── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center gap-2 space-y-0">
            <Key size={18} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
            <CardTitle className="font-bold text-base text-indigo-700 dark:text-indigo-400">License Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-1">
            <InfoRow label="License Status">
              <StatusBadge status={info?.status || "Error"} />
            </InfoRow>
            <InfoRow
              label="License Type"
              value={info?.license_type
                ? `${info.license_type}${info.is_lifetime ? " (Lifetime)" : ""}`
                : "—"}
            />
            {/* Client / Licensee — bound to active pharmacy name from database */}
            <InfoRow
              label="Client / Licensee"
              value={info?.pharmacy_name ?? info?.client_name ?? "—"}
            />
            <InfoRow label="Activation Date" value={info?.activation_date ?? "—"} />
            <InfoRow
              label="Expiry Date"
              value={info?.expiry_date ?? "—"}
            />
            <InfoRow label="Remaining Days">
              {info?.is_lifetime ? (
                <span className="text-sm font-bold text-primary flex items-center gap-1">
                  <Infinity size={16} /> Lifetime
                </span>
              ) : info?.remaining_days !== null && info?.remaining_days !== undefined ? (
                <span className={cn("text-sm font-bold", remainingColor(info.remaining_days))}>
                  {info.remaining_days} day{info.remaining_days !== 1 ? "s" : ""}
                  {info.remaining_days <= 14 && " ⚠ Expiring Soon"}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </InfoRow>
            <InfoRow label="License ID / Reference">
              <span className="font-mono text-xs text-foreground break-all text-right max-w-[180px]">
                {info?.license_id && info.license_id !== "N/A" ? info.license_id : "N/A"}
              </span>
            </InfoRow>
          </CardContent>
        </Card>

        {/* ── Hardware & Key Reference ── */}
        <div className="space-y-6">
          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl">
            <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center gap-2 space-y-0">
              <Cpu size={18} className="text-blue-600 dark:text-blue-400 drop-shadow-sm" />
              <CardTitle className="font-bold text-base text-blue-700 dark:text-blue-400">Hardware ID</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Generated from SHA-256(CPU ID + Motherboard UUID + MAC Address)
                </p>
                <div className="bg-secondary/50 border border-border rounded-xl p-3 font-mono text-sm text-foreground break-all">
                  {info?.hardware_id || "—"}
                </div>
              </div>
              <Button
                id="copy-hardware-id-btn"
                onClick={() => copyToClipboard(info?.hardware_id || "", "hwid")}
                variant="outline"
                className={cn(
                  "w-full gap-2 h-10 transition-all duration-200",
                  copiedHwid && "border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
                )}
                disabled={!info?.hardware_id}
              >
                {copiedHwid ? <><Check size={15} className="text-emerald-500" /> Copied!</> : <><Copy size={15} /> Copy Hardware ID</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(168,85,247,0.08)] rounded-2xl">
            <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-purple-600 dark:text-purple-400 drop-shadow-sm" />
                <CardTitle className="font-bold text-base text-purple-700 dark:text-purple-400">Key Reference</CardTitle>
              </div>
              {/* Show / Hide toggle — calls authenticated endpoint on first reveal */}
              <button
                id="toggle-key-visibility-btn"
                onClick={handleToggleKey}
                disabled={
                  revealLoading ||
                  !info?.key_reference ||
                  info.key_reference === "N/A" ||
                  info.key_reference === "No license file"
                }
                className={cn(
                  "rounded-lg p-1.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed",
                  showKey && "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20",
                )}
                title={showKey ? "Hide key" : "Reveal key"}
              >
                {revealLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : showKey
                  ? <EyeOff size={16} />
                  : <Eye size={16} />}
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className={cn(
                "bg-secondary/50 border border-border rounded-xl p-3 font-mono text-xs text-foreground break-all transition-all duration-200 min-h-[48px] flex items-center",
                !showKey && "tracking-widest text-muted-foreground select-none",
              )}>
                {showKey && revealedKey !== null
                  ? revealedKey
                  : (info?.key_reference && info.key_reference !== "N/A" && info.key_reference !== "No license file"
                    ? "•".repeat(32)
                    : "No license file")}
              </div>
              <Button
                id="copy-key-reference-btn"
                onClick={() => copyToClipboard(
                  revealedKey ?? info?.key_reference ?? "",
                  "key",
                )}
                variant="outline"
                className={cn(
                  "w-full gap-2 h-10 transition-all duration-200",
                  copiedKey && "border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
                )}
                disabled={!info?.key_reference || info.key_reference === "N/A" || info.key_reference === "No license file"}
              >
                {copiedKey ? <><Check size={15} className="text-emerald-500" /> Copied!</> : <><Copy size={15} /> Copy Key Reference</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── License File Information ── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(245,158,11,0.08)] rounded-2xl">
        <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center gap-2 space-y-0">
          <FileText size={18} className="text-amber-600 dark:text-amber-400 drop-shadow-sm" />
          <CardTitle className="font-bold text-base text-amber-700 dark:text-amber-400">License File Information</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-1">
          <InfoRow label="File Name" value={info?.license_file_info?.file_name ?? "No file found"} mono />
          <InfoRow label="File Location" value={info?.license_file_info?.file_path ?? "—"} mono />
          <InfoRow
            label="File Size"
            value={info?.license_file_info?.size_bytes != null
              ? formatBytes(info.license_file_info.size_bytes)
              : "—"}
          />
          <InfoRow label="Last Modified" value={info?.license_file_info?.last_modified ?? "—"} />
        </CardContent>
      </Card>

      {/* ── License Validation Status ── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(16,185,129,0.08)] rounded-2xl">
        <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 drop-shadow-sm" />
            <CardTitle className="font-bold text-base text-emerald-700 dark:text-emerald-400">License Validation Status</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={handleValidate}
            disabled={validating}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 h-9 rounded-xl"
          >
            {validating
              ? <><Loader2 size={14} className="animate-spin" /> Validating...</>
              : <><RefreshCw size={14} /> Run Validation</>}
          </Button>
        </CardHeader>
        <CardContent className="px-5 py-2">
          {validation ? (
            <>
              <CheckRow label="License file exists on disk" ok={validation.file_exists} />
              <CheckRow label="Digital signature is authentic (RSA-256)" ok={validation.signature_valid} />
              <CheckRow label="Hardware ID matches this machine" ok={validation.hardware_match} />
              <CheckRow label="License has not expired" ok={validation.not_expired} />
              <div className={cn(
                "mt-4 mb-3 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold",
                validation.overall_status === "PASSED"
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400"
              )}>
                {validation.overall_status === "PASSED" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                {validation.overall_status === "PASSED" ? "License passed all validation checks." : validation.error_message}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
              <ShieldCheck size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">Click "Run Validation" to perform a live license check.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Import New / Renewed License ── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl">
        <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center gap-2 space-y-0">
          <Upload size={18} className="text-blue-600 dark:text-blue-400 drop-shadow-sm" />
          <CardTitle className="font-bold text-base text-blue-700 dark:text-blue-400">Import New / Renewed License</CardTitle>
        </CardHeader>
        <CardContent className="p-7 space-y-6">
          <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <Info size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Only administrators can import a license. The new file will be validated before activation.
              A backup of the current license is automatically created.
            </p>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                if (!file.name.endsWith(".lic")) {
                  toast.error("Only .lic files are accepted.");
                  return;
                }
                setSelectedFile(file);
              }
            }}
            onClick={() => {
              if (!selectedFile) fileInputRef.current?.click();
            }}
            className={cn(
              "border-2 rounded-2xl p-10 text-center transition-all duration-200 relative",
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01] border-solid"
                : selectedFile
                  ? "border-primary/50 bg-secondary/30 border-solid"
                  : "border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 cursor-pointer"
            )}
          >
            {selectedFile ? (
              <div className="flex flex-col items-center justify-center gap-3 relative z-10">
                <div className="bg-primary/10 text-primary p-3 rounded-full">
                  <FileText size={28} />
                </div>
                <div>
                  <p className="font-bold text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{formatBytes(selectedFile.size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 text-muted-foreground transition-colors"
                  title="Remove file"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                  dragOver ? "bg-primary/10" : "bg-secondary"
                )}>
                  <Upload size={26} className={dragOver ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {dragOver ? "Release to upload" : "Drag & drop your .lic file here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse files</p>
                </div>
                <span className="text-xs font-mono bg-secondary border border-border px-3 py-1 rounded-full text-muted-foreground">
                  .lic files only
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".lic"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (!file.name.endsWith(".lic")) {
                    toast.error("Only .lic files are accepted.");
                    return;
                  }
                  setSelectedFile(file);
                }
              }}
            />
          </div>

          <Button
            onClick={() => {
              if (selectedFile) handleImportFile(selectedFile);
              else fileInputRef.current?.click();
            }}
            disabled={importing}
            className="w-full h-12 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-semibold transition-all"
          >
            {importing ? (
              <><Loader2 size={18} className="animate-spin" /> Importing &amp; Validating...</>
            ) : selectedFile ? (
              <><Upload size={18} /> Import License File</>
            ) : (
              <><Upload size={18} /> Browse &amp; Import License File</>
            )}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}

