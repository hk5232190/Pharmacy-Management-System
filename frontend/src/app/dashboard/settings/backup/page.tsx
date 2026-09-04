"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Database, HardDrive, Clock, FolderOpen, ShieldCheck, CheckCircle2,
  Loader2, Info, AlertTriangle, ArrowRight, RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { SaveButton } from "@/components/ui/save-button";

// ─── Types ───────────────────────────────────────────────────────────────────
interface BackupSettings {
  SettingsId: number;
  IsAutoBackupEnabled: boolean;
  BackupFrequency: string;
  BackupTime: string;
  BackupLocation: string;
  RetentionCount: number;
  BackupOnStartup: boolean;
  CompressBackup: boolean;
  AutoVerify: boolean;
}

interface DbInfo {
  engine: string;
  version: string;
  size_bytes: number;
  last_backup_date: string | null;
  total_backups: number;
}

interface DbHealth {
  status: "Healthy" | "Corrupted" | "Error";
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getAuthHeaders() {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BackupDataManagementSettingsPage() {
  const [settings, setSettings] = useState<BackupSettings>({
    SettingsId: 0,
    IsAutoBackupEnabled: false,
    BackupFrequency: "Daily",
    BackupTime: "23:00",
    BackupLocation: "./backups/automatic",
    RetentionCount: 7,
    BackupOnStartup: false,
    CompressBackup: true,
    AutoVerify: false,
  });
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [settingsRes, dbInfoRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/v1/backup-settings", { headers }),
        fetch("http://127.0.0.1:8000/api/v1/backup/db-info", { headers }),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (dbInfoRes.ok) setDbInfo(await dbInfoRes.json());
    } catch {
      toast.error("Failed to load backup configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Save Settings ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { SettingsId, ...payload } = settings;
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup-settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Backup configuration updated successfully");
      } else {
        toast.error("Failed to save settings.");
      }
    } catch {
      toast.error("Error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Health Check ───────────────────────────────────────────────────────────
  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/db-health", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data: DbHealth = await res.json();
        setDbHealth(data);
        if (data.status === "Healthy") toast.success(data.message);
        else toast.error(data.message);
      }
    } catch {
      toast.error("Failed to check database health.");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // ── Handle browse folder via Electron IPC ──────────────────────────────────
  const handleBrowse = async () => {
    try {
      const win = window as any;
      if (win?.electronAPI?.openFolderDialog) {
        const path = await win.electronAPI.openFolderDialog();
        if (path) setSettings(s => ({ ...s, BackupLocation: path }));
      } else {
        toast.info("Folder picker is only available in the desktop app.");
      }
    } catch {
      toast.error("Failed to open folder dialog.");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-muted-foreground">Loading backup configuration…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Backup &amp; Data Management</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure automatic backup preferences and monitor your database health.{" "}
          <Link href="/dashboard/backup" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
            Open Backup &amp; Restore module <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </div>

      {/* ── Section 1: Backup Preferences ──────────────────────────────────── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] rounded-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <CardHeader className="bg-gradient-to-r from-blue-50/80 to-transparent dark:from-transparent dark:to-transparent border-b border-slate-100 dark:border-slate-800 pb-5">
          <CardTitle className="text-xl flex items-center gap-2.5 text-blue-700 dark:text-blue-400 font-bold">
            <Clock className="h-5 w-5 drop-shadow-sm" />
            Backup Preferences
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">Set up automatic scheduled backups for your pharmacy database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">

          {/* Master toggle */}
          <div className={cn(
            "p-4 rounded-xl border transition-all duration-300 flex items-start space-x-3",
            settings.IsAutoBackupEnabled
              ? "bg-blue-50/50 dark:bg-secondary/30 border border-blue-200/40 dark:border-border shadow-sm"
              : "bg-slate-50/50 dark:bg-secondary/20 border-border"
          )}>
            <Checkbox
              id="autoBackup"
              className="mt-0.5 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white border-slate-300"
              checked={settings.IsAutoBackupEnabled}
              onCheckedChange={(c) => setSettings(s => ({ ...s, IsAutoBackupEnabled: c as boolean }))}
            />
            <div>
              <Label htmlFor="autoBackup" className={cn(
                "font-bold text-sm cursor-pointer",
                settings.IsAutoBackupEnabled ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-300"
              )}>
                Enable Automatic Scheduled Backups
              </Label>
              <p className={cn(
                "text-xs mt-1",
                settings.IsAutoBackupEnabled ? "text-blue-700/80 dark:text-blue-300/80" : "text-muted-foreground"
              )}>
                The system will automatically secure your database in the background on your chosen schedule.
              </p>
            </div>
          </div>

          {/* Schedule & Location */}
          <div className={cn(
            "space-y-5 transition-opacity duration-300",
            !settings.IsAutoBackupEnabled && "opacity-50 pointer-events-none"
          )}>
            {/* Frequency + Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">Backup Frequency</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-slate-50/70 dark:bg-secondary/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  value={settings.BackupFrequency}
                  onChange={(e) => setSettings(s => ({ ...s, BackupFrequency: e.target.value }))}
                  disabled={!settings.IsAutoBackupEnabled}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">Time of Day</Label>
                <Input
                  type="time"
                  value={settings.BackupTime}
                  onChange={(e) => setSettings(s => ({ ...s, BackupTime: e.target.value }))}
                  disabled={!settings.IsAutoBackupEnabled}
                  className="bg-slate-50/70 dark:bg-secondary/30 border-border"
                />
              </div>
            </div>

            {/* Backup Location */}
            <div className="space-y-1.5">
              <Label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">Backup Location</Label>
              <div className="flex gap-2">
                <Input
                  value={settings.BackupLocation}
                  onChange={(e) => setSettings(s => ({ ...s, BackupLocation: e.target.value }))}
                  disabled={!settings.IsAutoBackupEnabled}
                  className="font-mono text-sm bg-slate-50/70 dark:bg-secondary/30 border-border"
                />
                <Button variant="outline" type="button" onClick={handleBrowse} disabled={!settings.IsAutoBackupEnabled} className="shrink-0">
                  <FolderOpen className="mr-2 h-4 w-4 text-blue-500" /> Browse
                </Button>
              </div>
            </div>
          </div>

          {/* Retention */}
          <div className={cn(
            "space-y-1.5 transition-opacity duration-300",
            !settings.IsAutoBackupEnabled && "opacity-50 pointer-events-none"
          )}>
            <Label className="text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">Retention Policy</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.RetentionCount}
                onChange={(e) => setSettings(s => ({ ...s, RetentionCount: parseInt(e.target.value) || 7 }))}
                disabled={!settings.IsAutoBackupEnabled}
                className="max-w-[120px] bg-slate-50/70 dark:bg-secondary/30 border-border"
              />
              <span className="text-sm text-muted-foreground">maximum backups to keep (older ones are deleted automatically)</span>
            </div>
          </div>

          {/* Advanced checkboxes */}
          <div className={cn(
            "space-y-3 pt-2 border-t border-border/40 transition-opacity duration-300",
            !settings.IsAutoBackupEnabled && "opacity-50 pointer-events-none"
          )}>
            <div className="flex items-start gap-3">
              <Checkbox
                id="compress"
                checked={settings.CompressBackup}
                onCheckedChange={(c) => setSettings(s => ({ ...s, CompressBackup: c as boolean }))}
                disabled={!settings.IsAutoBackupEnabled}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="compress" className="text-sm font-medium cursor-pointer">Compress to ZIP Archive</Label>
                <p className="text-xs text-muted-foreground">Reduces storage size by compressing the SQLite backup file.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="autoVerify"
                checked={settings.AutoVerify}
                onCheckedChange={(c) => setSettings(s => ({ ...s, AutoVerify: c as boolean }))}
                disabled={!settings.IsAutoBackupEnabled}
                className="mt-0.5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
              <div>
                <Label htmlFor="autoVerify" className="text-sm font-medium cursor-pointer text-green-700 dark:text-green-500">Run Deep Verification after backup</Label>
                <p className="text-xs text-green-600/70 dark:text-green-500/60">AES-256 + SQLite integrity check after every automatic backup.</p>
              </div>
            </div>
          </div>

          {/* Startup backup – always active */}
          <div className="pt-2 border-t border-border/40 flex items-start gap-3">
            <Checkbox
              id="startupBackup"
              checked={settings.BackupOnStartup}
              onCheckedChange={(c) => setSettings(s => ({ ...s, BackupOnStartup: c as boolean }))}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="startupBackup" className="text-sm font-medium cursor-pointer">Backup on Application Startup</Label>
              <p className="text-xs text-muted-foreground">Auto-creates a backup when the software launches. (24-hour cooldown applies)</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border bg-slate-50/30 dark:bg-secondary/20 p-5 flex justify-end">
          <SaveButton isSaving={isSaving} onClick={handleSave} className="px-8" label="Save Configuration" />
        </CardFooter>
      </Card>

      {/* ── Section 2: Database Information ────────────────────────────────── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(16,185,129,0.08)] rounded-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardHeader className="bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-transparent dark:to-transparent border-b border-slate-100 dark:border-slate-800 pb-5">
          <CardTitle className="text-xl flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 font-bold">
            <Database className="h-5 w-5 drop-shadow-sm" />
            Database Information
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">Read-only summary of your active pharmacy database.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {dbInfo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Engine", value: dbInfo.engine },
                { label: "Version", value: `SQLite ${dbInfo.version}` },
                { label: "Database Size", value: formatBytes(dbInfo.size_bytes) },
                { label: "Total Backups", value: `${dbInfo.total_backups} backup${dbInfo.total_backups !== 1 ? "s" : ""}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50/50 dark:bg-secondary/20 rounded-lg p-4 border border-border">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Database information unavailable.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Database Health ──────────────────────────────────────── */}
      <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(139,92,246,0.08)] rounded-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
        <CardHeader className="bg-gradient-to-r from-violet-50/80 to-transparent dark:from-transparent dark:to-transparent border-b border-slate-100 dark:border-slate-800 pb-5">
          <CardTitle className="text-xl flex items-center gap-2.5 text-violet-700 dark:text-violet-400 font-bold">
            <ShieldCheck className="h-5 w-5 drop-shadow-sm" />
            Database Health
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">Run an integrity check to verify your database is not corrupted.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {dbHealth ? (
            <div className={cn(
              "flex items-start gap-3 p-4 rounded-xl border",
              dbHealth.status === "Healthy"
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            )}>
              {dbHealth.status === "Healthy"
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              }
              <div>
                <p className={cn("text-sm font-bold", dbHealth.status === "Healthy" ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300")}>
                  {dbHealth.status === "Healthy" ? "Database is Healthy" : `Status: ${dbHealth.status}`}
                </p>
                <p className={cn("text-xs mt-0.5", dbHealth.status === "Healthy" ? "text-emerald-700/80 dark:text-emerald-400/80" : "text-red-700/80 dark:text-red-400/80")}>
                  {dbHealth.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/50 dark:bg-secondary/20 border border-border">
              <Info className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">No health check has been run yet. Click below to check.</p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="gap-2 h-11 rounded-xl font-medium"
          >
            {isCheckingHealth
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
              : <><RefreshCcw className="h-4 w-4" /> Run Integrity Check</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* ── Link to full module ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-border bg-secondary/20">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Need to create, restore, or browse backup history?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Use the dedicated Backup &amp; Restore module for full backup management.</p>
        </div>
        <Link href="/dashboard/backup">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            Open Module <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

