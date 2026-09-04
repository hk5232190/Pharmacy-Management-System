"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lock, Shield, Timer, Wrench, HeartPulse, ScrollText,
  Trash2, AlertTriangle, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, RefreshCw, Key, ChevronRight, Database,
  FileWarning, ShieldAlert, ClipboardList, Eraser, Siren, Download, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SaveButton } from "@/components/ui/save-button";

const API = "http://127.0.0.1:8000/api/v1";

function getToken() {
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
}

function authHeaders() {
  return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "Passed" || status === "ok" || status === "Healthy") {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />{status}</span>;
  }
  if (status === "Failed" || status === "Corrupted") {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3" />{status}</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{status}</span>;
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, description, color = "blue" }: { icon: any, title: string, description: string, color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600",
  };
  return (
    <div className="flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${colors[color]} shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white text-base">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SecurityMaintenancePage() {
  // ── Change Password state ──
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // ── Security settings state ──
  const [secSettings, setSecSettings] = useState({
    AutoLockEnabled: false,
    AutoLockMinutes: 15,
    SessionTimeoutEnabled: true,
    SessionTimeoutMinutes: 120,
  });
  const [savedSecSettings, setSavedSecSettings] = useState({
    AutoLockEnabled: false,
    AutoLockMinutes: 15,
    SessionTimeoutEnabled: true,
    SessionTimeoutMinutes: 120,
  });
  const [isSavingSecSettings, setIsSavingSecSettings] = useState(false);

  // ── DB Optimize state ──
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<any>(null);

  // ── Integrity state ──
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);

  // ── Logs state ──
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logLevel, setLogLevel] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");
  const LOG_PAGE_SIZE = 100;

  // ── Clear temp state ──
  const [isClearingTemp, setIsClearingTemp] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);

  // ── Safe reset state ──
  const [resetPassword, setResetPassword] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);

  // ─── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSecuritySettings();
    fetchLogs(1);
  }, []);

  function formatBytes(b: number) {
    if (!b) return "0 B";
    const k = 1024, sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // ─── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchSecuritySettings = async () => {
    try {
      const res = await fetch(`${API}/security/settings`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSecSettings(data);
        setSavedSecSettings(data);
      }
    } catch {}
  };

  const fetchLogs = async (page: number, overrideLevel?: string) => {
    setIsLoadingLogs(true);
    const lvl = overrideLevel || logLevel;
    try {
      const res = await fetch(`${API}/security/logs?page=${page}&page_size=${LOG_PAGE_SIZE}&level=${lvl}&search=${encodeURIComponent(logSearch)}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.lines);
        setLogsTotal(data.total);
        setLogsPage(page);
      }
    } catch {
      toast.error("Failed to load application logs.");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const res = await fetch(`${API}/security/logs/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `app_audit_${new Date().getTime()}.log`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export logs.");
    }
  };

  // ─── Change Password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast.error("Please fill in all password fields."); return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("New password and confirmation do not match."); return;
    }
    if (newPwd.length < 6) {
      toast.error("New password must be at least 6 characters."); return;
    }
    setIsChangingPwd(true);
    try {
      const res = await fetch(`${API}/security/change-password`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password changed successfully.");
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      } else {
        toast.error(data.detail || "Failed to change password.");
      }
    } catch { toast.error("Error changing password."); }
    finally { setIsChangingPwd(false); }
  };

  // ─── Save Security Settings ─────────────────────────────────────────────────
  const handleSaveSecSettings = async () => {
    setIsSavingSecSettings(true);
    try {
      const res = await fetch(`${API}/security/settings`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(secSettings)
      });
      if (res.ok) {
        // Refresh token immediately to apply new timeout to current session
        const refreshRes = await fetch(`${API}/auth/refresh`, { method: "POST", headers: authHeaders() });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (localStorage.getItem("access_token")) {
            localStorage.setItem("access_token", data.access_token);
          } else {
            sessionStorage.setItem("access_token", data.access_token);
          }
        }
        toast.success("Auto Lock & Session Timeout updated successfully.");
        setSavedSecSettings(secSettings);
        // Notify other components/tabs that settings updated
        localStorage.setItem("security_settings_updated", Date.now().toString());
        window.dispatchEvent(new Event("security_settings_updated"));
      } else toast.error("Failed to save settings.");
    } catch { toast.error("Error saving settings."); }
    finally { setIsSavingSecSettings(false); }
  };

  // ─── DB Optimize ────────────────────────────────────────────────────────────
  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizeResult(null);
    try {
      const res = await fetch(`${API}/security/db-optimize`, {
        method: "POST", headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok) { setOptimizeResult(data); toast.success("Database optimized successfully."); }
      else toast.error(data.detail || "Optimization failed.");
    } catch { toast.error("Error optimizing database."); }
    finally { setIsOptimizing(false); }
  };

  // ─── Integrity Check ────────────────────────────────────────────────────────
  const handleIntegrityCheck = async () => {
    setIsCheckingIntegrity(true);
    setIntegrityResult(null);
    try {
      const res = await fetch(`${API}/security/db-integrity`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setIntegrityResult(data);
        if (data.integrity === "Passed") toast.success("Database integrity check passed.");
        else toast.error("Database integrity issues detected!");
      }
    } catch { toast.error("Integrity check failed."); }
    finally { setIsCheckingIntegrity(false); }
  };

  // ─── Clear Temp ─────────────────────────────────────────────────────────────
  const handleClearTemp = async () => {
    setIsClearingTemp(true);
    setClearResult(null);
    try {
      const res = await fetch(`${API}/security/clear-temp`, {
        method: "POST", headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok) { setClearResult(data); toast.success(data.message); }
      else toast.error(data.detail || "Failed to clear temp data.");
    } catch { toast.error("Error clearing temp data."); }
    finally { setIsClearingTemp(false); }
  };

  // ─── Safe Reset ─────────────────────────────────────────────────────────────
  const handleSafeResetClick = () => {
    if (resetPhrase !== "RESET ALL DATA") {
      toast.error('Type exactly: RESET ALL DATA'); return;
    }
    if (!resetPassword) {
      toast.error("Enter your admin password to confirm."); return;
    }
    setShowResetConfirmDialog(true);
  };

  const handleSafeReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`${API}/security/reset-data`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ password: resetPassword, confirmation_phrase: resetPhrase })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setResetPassword(""); setResetPhrase("");
      } else {
        toast.error(data.detail || "Reset failed.");
      }
    } catch { toast.error("Error during data reset."); }
    finally { setIsResetting(false); }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const totalLogPages = Math.ceil(logsTotal / LOG_PAGE_SIZE);

  return (
    <div className="space-y-6 pb-20 pr-2 lg:pr-4">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="h-7 w-7 text-blue-600" />
          Security &amp; Maintenance
        </h2>
        <p className="text-muted-foreground mt-1">
          Manage security configurations, perform database maintenance, and safeguard your pharmacy data.
        </p>
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { 
            label: "Auto Lock", 
            value: savedSecSettings.AutoLockEnabled ? `${savedSecSettings.AutoLockMinutes}m` : "Off", 
            icon: Lock, 
            accent: { border: "border-l-blue-500", icon: "text-blue-500", text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" } 
          },
          { 
            label: "Session Timeout", 
            value: savedSecSettings.SessionTimeoutEnabled ? `${savedSecSettings.SessionTimeoutMinutes}m` : "Off", 
            icon: Timer, 
            accent: { border: "border-l-purple-500", icon: "text-purple-500", text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" } 
          },
          { 
            label: "Audit Log Entries", 
            value: logsTotal.toLocaleString(), 
            icon: ScrollText, 
            accent: { border: "border-l-emerald-500", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" } 
          },
          { 
            label: "DB Integrity", 
            value: integrityResult ? (integrityResult.integrity === "Passed" ? "Passed" : "Errors Found") : "Not Checked", 
            icon: HeartPulse, 
            accent: integrityResult?.integrity === "Passed" 
              ? { border: "border-l-emerald-500", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" } 
              : integrityResult?.integrity === "Failed"
                ? { border: "border-l-rose-500", icon: "text-rose-500", text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20" }
                : { border: "border-l-amber-500", icon: "text-amber-500", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" }
          },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className={`relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md ${accent.border}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent.bg}`}>
              <Icon className={`h-5 w-5 ${accent.icon}`} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
              <p className={`text-2xl font-extrabold leading-none tabular-nums truncate ${accent.text}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Change Password ─────────────────────────────────────── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <SectionHeader icon={Key} title="Change Password" description="Update your master admin password." color="blue" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPwd">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPwd"
                  type={showCurrentPwd ? "text" : "password"}
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCurrentPwd(p => !p)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPwd">New Password</Label>
              <div className="relative">
                <Input id="newPwd" type={showNewPwd ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min. 6 characters" />
                <button type="button" onClick={() => setShowNewPwd(p => !p)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPwd">Confirm New Password</Label>
              <div className="relative">
                <Input id="confirmPwd" type={showConfirmPwd ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Re-enter new password" />
                <button type="button" onClick={() => setShowConfirmPwd(p => !p)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><XCircle className="h-3 w-3" /> Passwords do not match</p>
              )}
              {confirmPwd && newPwd === confirmPwd && (
                <p className="text-xs text-green-500 flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
              )}
            </div>
            {/* Password strength indicator */}
            {newPwd && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Password Strength</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(level => (
                    <div key={level} className={`h-1.5 flex-1 rounded-full transition-colors ${
                      newPwd.length >= level * 3
                        ? level <= 1 ? "bg-red-400" : level <= 2 ? "bg-amber-400" : level <= 3 ? "bg-blue-400" : "bg-green-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end bg-slate-50/50 dark:bg-secondary/20 rounded-b-xl">
            <Button onClick={handleChangePassword} disabled={isChangingPwd || newPwd !== confirmPwd} className="bg-blue-600 hover:bg-blue-700 text-white w-40">
              {isChangingPwd ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : <><Key className="h-4 w-4 mr-2" /> Change Password</>}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Auto Lock & Session Timeout ─────────────────────────── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(168,85,247,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <SectionHeader icon={Lock} title="Auto Lock &amp; Session Timeout" description="Configure inactivity lock and JWT session expiry behaviour." color="purple" />
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Auto Lock */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Auto Lock Screen</p>
                <p className="text-xs text-slate-500 mt-0.5">Lock the UI after a period of inactivity</p>
              </div>
              <button
                onClick={() => setSecSettings(s => ({ ...s, AutoLockEnabled: !s.AutoLockEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${secSettings.AutoLockEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${secSettings.AutoLockEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className={`space-y-2 pl-1 transition-opacity ${!secSettings.AutoLockEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <Label>Lock after (minutes)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={1} max={120} value={secSettings.AutoLockMinutes}
                  onChange={e => setSecSettings(s => ({ ...s, AutoLockMinutes: parseInt(e.target.value) || 15 }))}
                  className="w-28"
                  disabled={!secSettings.AutoLockEnabled}
                />
                <span className="text-sm text-slate-500">minutes of inactivity</span>
              </div>
            </div>

            {/* Session Timeout */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Session Timeout</p>
                <p className="text-xs text-slate-500 mt-0.5">Automatically log out after JWT expires</p>
              </div>
              <button
                onClick={() => setSecSettings(s => ({ ...s, SessionTimeoutEnabled: !s.SessionTimeoutEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${secSettings.SessionTimeoutEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${secSettings.SessionTimeoutEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className={`space-y-2 pl-1 transition-opacity ${!secSettings.SessionTimeoutEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <Label>Session duration (minutes)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={15} max={1440} value={secSettings.SessionTimeoutMinutes}
                  onChange={e => setSecSettings(s => ({ ...s, SessionTimeoutMinutes: parseInt(e.target.value) || 120 }))}
                  className="w-28"
                  disabled={!secSettings.SessionTimeoutEnabled}
                />
                <span className="text-sm text-slate-500">minutes ({Math.floor(secSettings.SessionTimeoutMinutes / 60)}h {secSettings.SessionTimeoutMinutes % 60}m)</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end bg-slate-50/50 dark:bg-secondary/20 rounded-b-xl">
            <SaveButton isSaving={isSavingSecSettings} onClick={handleSaveSecSettings} className="w-36" label="Save Settings" />
          </CardFooter>
        </Card>

        {/* ── Database Optimization ───────────────────────────────── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(34,197,94,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-green-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <SectionHeader icon={Wrench} title="Database Optimization" description="Run VACUUM to reclaim space and ANALYZE to rebuild query statistics." color="green" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-50/50 dark:bg-secondary/30 rounded-lg text-sm text-blue-700 dark:text-blue-400 border border-border flex items-start gap-2">
              <Database className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Optimization rebuilds the database file to reclaim deleted space and update query planner statistics. This is safe to run while the system is active.</p>
            </div>
            {optimizeResult && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50/50 dark:bg-secondary/20 px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border uppercase tracking-wider">Optimization Result</div>
                <div className="grid grid-cols-3 divide-x text-center">
                  {[
                    { label: "Before", value: formatBytes(optimizeResult.before_size_bytes) },
                    { label: "After", value: formatBytes(optimizeResult.after_size_bytes) },
                    { label: "Reclaimed", value: formatBytes(Math.max(0, optimizeResult.reclaimed_bytes)) },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-semibold text-slate-900 dark:text-white mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end bg-slate-50/50 dark:bg-secondary/20 rounded-b-xl">
            <Button onClick={handleOptimize} disabled={isOptimizing || isCheckingIntegrity} className="bg-green-600 hover:bg-green-700 text-white w-48">
              {isOptimizing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Optimizing…</> : <><Wrench className="h-4 w-4 mr-2" /> Run Optimization</>}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Integrity Check ─────────────────────────────────────── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(245,158,11,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <SectionHeader icon={HeartPulse} title="Integrity Check" description="Run a full SQLite PRAGMA integrity_check and foreign key validation." color="amber" />
          </CardHeader>
          <CardContent className="space-y-4">
            {integrityResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-900">
                  <span className="text-sm font-medium">Overall Status</span>
                  <StatusBadge status={integrityResult.integrity} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: "Tables", value: integrityResult.table_count },
                    { label: "Pages", value: integrityResult.page_count },
                    { label: "Free Pages", value: integrityResult.free_pages },
                    { label: "FK Violations", value: integrityResult.foreign_key_violations },
                    { label: "File Size", value: formatBytes(integrityResult.file_size_bytes) },
                    { label: "Schema Version", value: integrityResult.schema_version },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between p-2 rounded border">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
                {integrityResult.integrity_details.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Issues Detected:</p>
                    {integrityResult.integrity_details.map((d: string, i: number) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400">{d}</p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400">Checked at: {new Date(integrityResult.checked_at).toLocaleString()}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <HeartPulse className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Click below to run the integrity check</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end bg-slate-50/50 dark:bg-secondary/20 rounded-b-xl">
            <Button onClick={handleIntegrityCheck} disabled={isCheckingIntegrity || isOptimizing} className="bg-amber-600 hover:bg-amber-700 text-white w-48">
              {isCheckingIntegrity ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking…</> : <><HeartPulse className="h-4 w-4 mr-2" /> Run Check</>}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Application Logs ──────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(100,116,139,0.08)] rounded-2xl">
        <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-100/80 to-transparent dark:from-transparent dark:to-transparent">
          <div className="flex items-start justify-between">
            <SectionHeader icon={ScrollText} title="Application Logs" description={`Structured audit trail from app_audit.log — ${logsTotal.toLocaleString()} entries, newest first.`} color="slate" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchLogs(1)}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportLogs}>
                <Download className="h-4 w-4 mr-1.5" />
                Export Log
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
              {["ALL", "AUDIT", "ERROR"].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => { setLogLevel(lvl); fetchLogs(1, lvl); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${logLevel === lvl ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  {lvl === "ALL" ? "All" : lvl === "AUDIT" ? "Audit Actions" : "Errors Only"}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search logs (press Enter)..." 
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLogs(1)}
                className="h-9 pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg border border-border bg-black/40 dark:bg-black/50 overflow-hidden">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading logs…
              </div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <ClipboardList className="h-8 w-8 mr-2 opacity-40" /> No log entries found.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-96 font-mono text-xs leading-5">
                {logs.map((entry, i) => {
                  const isError = entry.level === "ERROR";
                  const isAudit = entry.level === "AUDIT";
                  return (
                    <div key={i} className={`px-3 py-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/40 transition-colors ${isError ? "text-red-400" : isAudit ? "text-cyan-400" : "text-slate-400"}`}>
                      {entry.timestamp && <span className="shrink-0 opacity-70 whitespace-nowrap">{entry.timestamp}</span>}
                      {entry.level && entry.level !== "INFO" && (
                        <span className={`shrink-0 font-bold ${isError ? "text-red-500" : "text-cyan-500"}`}>[{entry.level}]</span>
                      )}
                      {entry.module && <span className="shrink-0 opacity-50">[{entry.module}]</span>}
                      <span className="break-all">{entry.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Pagination */}
          {totalLogPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
              <span>Page {logsPage} of {totalLogPages} ({logsTotal.toLocaleString()} entries)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={logsPage <= 1} onClick={() => fetchLogs(logsPage - 1)}>← Prev</Button>
                <Button variant="outline" size="sm" disabled={logsPage >= totalLogPages} onClick={() => fetchLogs(logsPage + 1)}>Next →</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Clear Temporary Data ─────────────────────────────────── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <SectionHeader icon={Eraser} title="Clear Temporary Data" description="Remove print spooler files and temporary data from the system." color="blue" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
              <p>This removes temporary files from the print spooler directory and backend root. Your database and settings are not affected.</p>
            </div>
            {clearResult && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400">
                <p className="font-semibold">{clearResult.message}</p>
                <p className="text-xs opacity-80 mt-1">Files cleared: {clearResult.files_cleared} | Space reclaimed: {clearResult.size_reclaimed_kb} KB</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end bg-slate-50/50 dark:bg-secondary/20 rounded-b-xl">
            <Button onClick={handleClearTemp} disabled={isClearingTemp} className="w-48 bg-slate-700 hover:bg-slate-800 text-white">
              {isClearingTemp ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Clearing…</> : <><Trash2 className="h-4 w-4 mr-2" /> Clear Temp Files</>}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Safe Data Reset ──────────────────────────────────────── */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-red-200/80 dark:ring-red-900/60 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(239,68,68,0.12)] rounded-2xl bg-red-50/10 dark:bg-red-950/5">
          <CardHeader className="pb-5 border-b border-red-100 dark:border-red-900/40 bg-gradient-to-r from-red-50/80 to-transparent dark:from-red-950/40 dark:to-transparent">
            <SectionHeader icon={ShieldAlert} title="Safe Data Reset" description="Permanently wipe all transactional and master data. Settings are preserved." color="red" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Irreversible Operation</p>
                <p className="text-xs mt-1 opacity-90">All medicines, purchases, sales, customers, suppliers, and backup history will be permanently deleted. A safety snapshot will be created before wiping. Settings, profiles, and license data are preserved.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resetPhrase">Type confirmation phrase</Label>
              <Input
                id="resetPhrase"
                placeholder='Type: RESET ALL DATA'
                value={resetPhrase}
                onChange={e => setResetPhrase(e.target.value)}
                className={`font-mono ${resetPhrase && resetPhrase !== "RESET ALL DATA" ? "border-red-400" : ""}`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resetPassword">Admin Password</Label>
              <div className="relative">
                <Input
                  id="resetPassword"
                  type={showResetPwd ? "text" : "password"}
                  placeholder="Your admin password to authorize reset"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowResetPwd(p => !p)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showResetPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-red-100 dark:border-red-900/40 pt-4 flex justify-end bg-red-50/30 dark:bg-red-950/10 rounded-b-xl">
            <Button
              onClick={handleSafeResetClick}
              disabled={isResetting || resetPhrase !== "RESET ALL DATA" || !resetPassword}
              className="w-48 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              {isResetting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Resetting…</> : <><Siren className="h-4 w-4 mr-2" /> Execute Reset</>}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* ── Confirmation Dialog ── */}
      <Dialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500 text-xl">
              <ShieldAlert className="h-6 w-6" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription className="pt-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              You are about to <strong>permanently delete</strong> all your medicines, sales, purchases, and operational history.
              <br /><br />
              Even though a snapshot will be taken, this action will immediately disrupt the system's current operating state and clear all dashboard statistics.
              <br /><br />
              <span className="text-red-600 dark:text-red-400 font-semibold block bg-red-50 dark:bg-red-950/30 p-2.5 rounded-md border border-red-100 dark:border-red-900">Are you absolutely sure you want to proceed?</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 flex gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setShowResetConfirmDialog(false)} className="sm:flex-1">
              Cancel
            </Button>
            <Button 
              onClick={() => { setShowResetConfirmDialog(false); handleSafeReset(); }} 
              className="sm:flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 dark:shadow-none"
            >
              Yes, Destroy Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {isResetting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <Loader2 className="h-16 w-16 animate-spin text-red-500 mb-6" />
          <h2 className="text-2xl font-bold">Wiping Database...</h2>
          <p className="opacity-80 mt-2">Creating safety snapshot and permanently deleting data.</p>
          <p className="opacity-80">Please do not close or refresh this page.</p>
        </div>
      )}
    </div>
  );
}
