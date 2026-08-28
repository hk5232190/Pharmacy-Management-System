"use client";

import { useState, useEffect } from "react";
import { 
  RefreshCw, Settings, Calendar, Database, HardDrive, HeartPulse, 
  ShieldCheck, Clock, DownloadCloud, RotateCcw, History, Edit2, 
  FolderOpen, Info, CheckCircle2, Search, Filter, 
  ArrowRight, Loader2, Trash2, XCircle, PauseCircle, Check, RefreshCcw,
  Eye, EyeOff, AlertTriangle, Lock
} from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Accent colour map for KPI Cards
const accentMap: Record<string, { border: string; icon: string; text: string; bg: string }> = {
  blue:    { border: "border-l-blue-500",    icon: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  emerald: { border: "border-l-emerald-500", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  purple:  { border: "border-l-purple-500",  icon: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",  bg: "bg-purple-50 dark:bg-purple-900/20" },
  orange:  { border: "border-l-orange-500",  icon: "text-orange-500",  text: "text-orange-600 dark:text-orange-400",  bg: "bg-orange-50 dark:bg-orange-900/20" },
  amber:   { border: "border-l-amber-500",   icon: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  indigo:  { border: "border-l-indigo-500",  icon: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  rose:    { border: "border-l-rose-500",    icon: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-900/20" },
  slate:   { border: "border-l-slate-400",   icon: "text-slate-400",   text: "text-slate-500 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800/40" },
};

function KPICard({ title, value, icon, accent = "blue", children }: { title: string; value: React.ReactNode; icon: React.ReactNode; accent?: string; children?: React.ReactNode }) {
  const a = accentMap[accent] ?? accentMap.blue;
  return (
    <div className={cn(
      "relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-3.5 flex flex-col gap-2 overflow-hidden transition-shadow hover:shadow-md",
      a.border
    )}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mb-1", a.bg)}>
        <span className={cn(a.icon, "[&>svg]:h-5 [&>svg]:w-5")}>{icon}</span>
      </div>
      <div className="flex flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
        <div className={cn("text-xl md:text-2xl font-extrabold leading-none tabular-nums tracking-tight", a.text)}>{value}</div>
        {children && <div className="mt-2.5 pt-2.5 border-t border-border/40">{children}</div>}
      </div>
    </div>
  );
}

export default function BackupRestorePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  const [activeTab, setActiveTab] = useState("manual");

  const handleRefresh = () => {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1500);
    }, 400);
  };

  return <BackupRestorePageInner 
    key={refreshKey} 
    refreshState={refreshState} 
    onRefresh={handleRefresh} 
    activeTab={activeTab} 
    onTabChange={setActiveTab}
  />;
}

function BackupRestorePageInner({
  onRefresh,
  refreshState,
  activeTab,
  onTabChange
}: {
  onRefresh: () => void;
  refreshState: "idle" | "loading" | "done";
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const [backupName, setBackupName] = useState("");
  const [backupLocation, setBackupLocation] = useState("./backups");
  const [compress, setCompress] = useState(true);
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0); // 0–100 for animation
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("All");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("All");
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;
  
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null);

  const [expandedBackupId, setExpandedBackupId] = useState<number | null>(null);
  const [hoveredBackupId, setHoveredBackupId] = useState<number | null>(null);

  const [verificationReport, setVerificationReport] = useState<any>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [restoreFilePath, setRestoreFilePath] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState("");

  const [settings, setSettings] = useState({
    IsAutoBackupEnabled: false,
    BackupFrequency: "Daily",
    BackupTime: "23:00",
    BackupLocation: "./backups/automatic",
    RetentionCount: 7,
    BackupOnStartup: false,
    CompressBackup: true,
    AutoVerify: true
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [dbInfo, setDbInfo] = useState<any>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [diskSpace, setDiskSpace] = useState<string | null>(null);
  const [isLoadingModule, setIsLoadingModule] = useState(true);

  // Initialize
  useEffect(() => {
    generateBackupName();
    const loadAll = async () => {
      setIsLoadingModule(true);
      await Promise.all([
        fetchHistory(),
        fetchSettings(),
        fetchDbInfo(),
        autoCheckHealth()
      ]);
      setIsLoadingModule(false);
    };
    loadAll();
  }, []);

  // Re-fetch disk space whenever backup location changes
  useEffect(() => {
    const timer = setTimeout(() => fetchDiskSpace(backupLocation), 500);
    return () => clearTimeout(timer);
  }, [backupLocation]);

  const generateBackupName = () => {
    const now = new Date();
    setBackupName(`Backup_${format(now, "yyyy_MM_dd_HHmmss")}`);
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/history", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackupHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch backup history", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup-settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
    }
  };

  const fetchDbInfo = async () => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/db-info", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch DB info", error);
    }
  };

  /** Silent auto-health-check on mount — no toast, just sets state */
  const autoCheckHealth = async () => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/db-health", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbHealth(data);
      }
    } catch {
      // Silently fail — user can click "Check Now" manually
    }
  };

  const fetchDiskSpace = async (path: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/backup/disk-space?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.free_readable) setDiskSpace(data.free_readable);
      }
    } catch {
      setDiskSpace(null);
    }
  };

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/db-health", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbHealth(data);
        if (data.status === "Healthy") toast.success(data.message);
        else toast.error(data.message);
      }
    } catch (error) {
      toast.error("Failed to check database health.");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup-settings", {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("Backup configuration updated successfully");
      } else {
        toast.error("Failed to save settings.");
      }
    } catch (e) {
      toast.error("Error saving settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!backupName || !backupLocation) {
      toast.error("Please provide a backup name and location");
      return;
    }

    setIsBackingUp(true);
    setBackupProgress(0);

    // Simulate a smooth progress animation (real work happens in backend)
    const interval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + Math.random() * 8;
      });
    }, 400);

    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          backup_name: backupName,
          backup_location: backupLocation,
          compress: compress
        })
      });

      const data = await res.json();

      clearInterval(interval);
      setBackupProgress(100);

      if (res.ok) {
        toast.success("Backup created successfully!");
        generateBackupName();
        fetchHistory();
        fetchDbInfo();
      } else {
        toast.error(data.detail || "Failed to create backup");
      }
    } catch (error) {
      clearInterval(interval);
      toast.error("An error occurred while communicating with the server.");
    } finally {
      setTimeout(() => {
        setIsBackingUp(false);
        setBackupProgress(0);
      }, 600);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFilePath) {
      toast.error("Please provide a backup file path");
      return;
    }
    if (!adminPassword) {
      toast.error("Please provide your admin password to authorize the restore");
      return;
    }

    setIsRestoring(true);
    setRestoreStatus("Validating backup integrity and schema... (Creating Safety Backup)");
    
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          backup_file_path: restoreFilePath,
          password: adminPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setRestoreStatus("Restore successful. Reloading...");
        toast.success(data.message || "Database restored successfully!");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(data.detail || "Failed to restore backup");
        setRestoreStatus("");
      }
    } catch (error) {
      toast.error("An error occurred during restore.");
      setRestoreStatus("");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/browse-folder");
      const data = await res.json();
      if (data.path) {
        setBackupLocation(data.path);
      }
    } catch (e) {
      toast.error("Could not open folder browser.");
    }
  };

  const handleBrowseSettingsFolder = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/browse-folder");
      const data = await res.json();
      if (data.path) {
        setSettings({ ...settings, BackupLocation: data.path });
      }
    } catch (e) {
      toast.error("Could not open folder browser.");
    }
  };

  const handleBrowseFile = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/backup/browse-file");
      const data = await res.json();
      if (data.path) {
        setRestoreFilePath(data.path);
      }
    } catch (e) {
      toast.error("Could not open file browser.");
    }
  };

  const handleDeleteBackup = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this backup file? This cannot be undone.")) return;
    
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/backup/history/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Backup permanently deleted.");
        fetchHistory();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to delete backup.");
      }
    } catch (e) {
      toast.error("An error occurred while deleting.");
    }
  };

  const handleVerifyBackup = async (id: number) => {
    setIsVerifying(true);
    setVerificationReport(null);
    setIsVerifyModalOpen(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/backup/history/${id}/verify`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationReport(data);
      } else {
        toast.error(data.detail || "Failed to verify backup.");
        setIsVerifyModalOpen(false);
      }
    } catch (e) {
      toast.error("An error occurred during verification.");
      setIsVerifyModalOpen(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenFolder = async (id: number) => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/backup/history/${id}/open-folder`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || "Failed to open folder.");
      }
    } catch (e) {
      toast.error("Could not send open folder command.");
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  // ─── Derived state for smart KPI cards ───────────────────────────────────
  const hasEverBacked = !!dbInfo?.last_backup_date;
  const lastBackupAccent = hasEverBacked ? "blue" : "slate";
  const lastBackupValue = hasEverBacked
    ? format(new Date(dbInfo.last_backup_date + "Z"), "MMM dd, yyyy")
    : "Never";

  const autoEnabled = settings.IsAutoBackupEnabled;
  const nextScheduledValue = autoEnabled ? "Tomorrow" : "Paused";
  const nextScheduledAccent = autoEnabled ? "indigo" : "slate";

  const dbStatusAccent =
    dbHealth?.status === "Healthy" ? "emerald" :
    dbHealth?.status === "Corrupted" ? "rose" :
    dbHealth ? "orange" : "slate";

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Backup &amp; Restore</h2>
          <p className="text-muted-foreground">Protect your pharmacy data by creating secure backups, restoring previous versions, and managing backup history.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className={cn(
              "h-9 gap-2 transition-all duration-300 rounded-full",
              refreshState === "loading" && "border-primary/40 text-primary",
              refreshState === "done" && "border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20"
            )}
            onClick={onRefresh}
            disabled={refreshState === "loading"}
          >
            {refreshState === "done" ? (
              <Check className="h-4 w-4 animate-in zoom-in-50 duration-200" />
            ) : (
              <RefreshCcw className={cn("h-4 w-4 transition-transform", refreshState === "loading" && "animate-spin")} />
            )}
            {refreshState === "loading" ? "Refreshing..." : refreshState === "done" ? "Updated!" : "Refresh"}
          </Button>
        </div>
      </div>

      {isLoadingModule ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-muted-foreground">Loading backup data...</p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {/* Last Backup */}
        <KPICard
          title="Last Backup"
          value={lastBackupValue}
          icon={<Calendar className="h-6 w-6" />}
          accent={lastBackupAccent}
        >
          {hasEverBacked ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Successful
            </p>
          ) : (
            <p className="text-xs text-slate-400 flex items-center">
              <XCircle className="h-3.5 w-3.5 mr-1" /> No backups yet
            </p>
          )}
        </KPICard>

        {/* Total Backups */}
        <KPICard
          title="Total Backups"
          value={dbInfo?.total_backups || 0}
          icon={<Database className="h-6 w-6" />}
          accent="purple"
        >
          <p className="text-xs text-muted-foreground flex items-center">
            Available in history
          </p>
        </KPICard>

        {/* Database Storage */}
        <KPICard
          title="Database Storage"
          value={formatBytes(dbInfo?.size_bytes || 0)}
          icon={<HardDrive className="h-6 w-6" />}
          accent="blue"
        >
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full w-[5%]"></div>
          </div>
          <p className="text-xs text-muted-foreground">Current Active Database</p>
        </KPICard>

        {/* Automatic Backup */}
        <KPICard
          title="Automatic Backup"
          value={
            <span className={autoEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}>
              {autoEnabled ? "Enabled" : "Disabled"}
            </span>
          }
          icon={<HeartPulse className="h-6 w-6" />}
          accent={autoEnabled ? "emerald" : "slate"}
        >
          <p className="text-xs text-muted-foreground">
            {autoEnabled ? `${settings.BackupFrequency} at ${settings.BackupTime}` : "Turn on in settings"}
          </p>
        </KPICard>

        {/* Database Status — auto-checked on mount */}
        <KPICard
          title="Database Status"
          value={
            <span className={
              dbHealth?.status === "Healthy" ? "text-emerald-600 dark:text-emerald-400" :
              dbHealth?.status === "Corrupted" ? "text-rose-600 dark:text-rose-400" :
              dbHealth ? "text-orange-600 dark:text-orange-400" :
              "text-slate-400"
            }>
              {dbHealth?.status || "Unknown"}
            </span>
          }
          icon={<ShieldCheck className="h-6 w-6" />}
          accent={dbStatusAccent}
        >
          <p className={`text-xs flex items-center font-medium ${dbHealth?.status === "Healthy" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {dbHealth?.status === "Healthy" ? (
              <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Protected</>
            ) : (
              <Button variant="link" className="p-0 h-auto text-xs" onClick={handleCheckHealth}>
                {isCheckingHealth ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Checking...</> : "Check Now"}
              </Button>
            )}
          </p>
        </KPICard>

        {/* Next Scheduled — Paused if auto-backup is off */}
        <KPICard
          title="Next Scheduled"
          value={nextScheduledValue}
          icon={autoEnabled ? <Clock className="h-6 w-6" /> : <PauseCircle className="h-6 w-6" />}
          accent={nextScheduledAccent}
        >
          {autoEnabled ? (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center font-medium">
              <Clock className="h-3.5 w-3.5 mr-1" /> {settings.BackupFrequency} at {settings.BackupTime}
            </p>
          ) : (
            <p className="text-xs text-slate-400 flex items-center">
              <PauseCircle className="h-3.5 w-3.5 mr-1" /> Auto-backup is off
            </p>
          )}
        </KPICard>
      </div>

      {/* ── Action Tabs ──────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-border mb-6 mt-10">
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto custom-scrollbar">
          <button
            onClick={() => onTabChange("manual")}
            className={cn(
              "flex items-center px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
              activeTab === "manual" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <DownloadCloud className="mr-2 h-4 w-4" />
            Manual Backup
          </button>
          <button
            onClick={() => onTabChange("restore")}
            className={cn(
              "flex items-center px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
              activeTab === "restore" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore Backup
          </button>
          <button
            onClick={() => onTabChange("history")}
            className={cn(
              "flex items-center px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
              activeTab === "history" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <History className="mr-2 h-4 w-4" />
            Backup History
          </button>
          <button
            onClick={() => onTabChange("settings")}
            className={cn(
              "flex items-center px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
              activeTab === "settings" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <Settings className="mr-2 h-4 w-4" />
            Backup Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* ── Main Content ────────────────────────────────────────────────── */}
        <div className={cn("space-y-6", activeTab === "history" ? "md:col-span-3" : "md:col-span-2")}>
          {/* Manual Backup Tab */}
          {activeTab === "manual" && (
            <Card className="shadow-sm border-border/60 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b pb-4">
                <CardTitle className="text-lg flex items-center">
                  <DownloadCloud className="h-5 w-5 mr-2 text-blue-500" />
                  Create Manual Backup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Form */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="backupName" className="font-semibold text-slate-700 dark:text-slate-300">Backup Name</Label>
                      <div className="relative group">
                        <Input 
                          id="backupName" 
                          value={backupName} 
                          onChange={(e) => setBackupName(e.target.value)} 
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-colors focus:bg-white"
                        />
                        <Edit2 className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backupLocation" className="font-semibold text-slate-700 dark:text-slate-300">Backup Location</Label>
                      <div className="flex space-x-2">
                        <Input 
                          id="backupLocation" 
                          value={backupLocation} 
                          onChange={(e) => setBackupLocation(e.target.value)} 
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono text-sm"
                        />
                        <Button variant="outline" onClick={handleBrowseFolder} type="button" className="shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <FolderOpen className="mr-2 h-4 w-4 text-blue-500"/> Browse
                        </Button>
                      </div>
                      {/* Disk Space Display */}
                      {diskSpace ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <HardDrive className="h-3.5 w-3.5" />
                          <span><strong>{diskSpace}</strong> free on selected drive</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Fetching available disk space...</p>
                      )}
                    </div>
                    <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 p-3.5 rounded-lg flex items-start text-sm shadow-sm">
                      <Info className="h-5 w-5 mr-2.5 shrink-0 mt-0.5 text-blue-500" />
                      <p className="leading-relaxed">Ensure the selected location has enough free space to comfortably store the new backup file.</p>
                    </div>
                  </div>

                  {/* Right Column: Info & Options */}
                  <div className="space-y-6 bg-slate-50 dark:bg-slate-900/30 p-5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                        <Database className="h-4 w-4 mr-2 text-purple-500" />
                        System Information
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Database Engine</span>
                          <span className="font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">SQLite</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">App Version</span>
                          <span className="font-semibold">1.0.0.0</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">SQLite Version</span>
                          <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">
                            {dbInfo?.version
                              ? dbInfo.version
                              : <span className="text-muted-foreground italic">Loading...</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                        <Settings className="h-4 w-4 mr-2 text-slate-500" />
                        Backup Options
                      </h4>
                      <div className="space-y-3 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2.5">
                          <Checkbox id="includeDb" checked disabled className="opacity-70" />
                          <Label htmlFor="includeDb" className="text-sm font-medium cursor-not-allowed text-muted-foreground">Include Database (Required)</Label>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <Checkbox id="compress" checked={compress} onCheckedChange={(c) => setCompress(c as boolean)} />
                          <Label htmlFor="compress" className="text-sm font-medium cursor-pointer">Compress Backup File (.zip)</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar shown while backing up */}
                {isBackingUp && (
                  <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900 mt-4 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        {compress ? "Compressing & creating backup..." : "Creating backup..."}
                      </span>
                      <span className="text-xs text-muted-foreground">{Math.round(backupProgress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${backupProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Executing SQLite online backup engine… Generating SHA-256 checksum…</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-center border-t border-border/40 p-5 bg-slate-50/50 dark:bg-slate-900/20">
                <Button 
                  size="lg" 
                  onClick={handleCreateBackup} 
                  disabled={isBackingUp || !backupName}
                  className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 font-semibold text-base py-6 rounded-xl"
                >
                  {isBackingUp ? (
                    <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Creating Backup...</>
                  ) : (
                    <><DownloadCloud className="mr-3 h-5 w-5" /> Create Secure Backup</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Restore Tab */}
          {activeTab === "restore" && (
            <>
            <Card className="shadow-sm border-border/60 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500"></div>
              <CardHeader className="bg-red-50/50 dark:bg-red-950/20 border-b border-red-100/50 dark:border-red-900/50 pb-4">
                <CardTitle className="text-lg flex items-center text-red-700 dark:text-red-400">
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Restore Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                
                {/* Warning Alert */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mr-3 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-400">
                    <p className="font-semibold mb-1">Warning: Data Overwrite</p>
                    <p className="opacity-90">Restoring a backup will completely overwrite your current database. A safety snapshot will be created automatically before the restore process begins in case you need to revert.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="restoreFilePath" className="text-slate-700 dark:text-slate-300 font-medium">Backup File Path</Label>
                    <div className="flex space-x-2">
                      <Input 
                        id="restoreFilePath" 
                        placeholder="e.g. ./backups/Backup_2026_08_28_162415.zip" 
                        value={restoreFilePath} 
                        onChange={(e) => setRestoreFilePath(e.target.value)} 
                        className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono text-sm"
                      />
                      <Button variant="outline" onClick={handleBrowseFile} type="button" className="shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <FolderOpen className="mr-2 h-4 w-4 text-blue-500"/> Browse
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Info className="h-3.5 w-3.5 mr-1" />
                      Select from the "Available Backups" list on the right, or browse your system.
                    </p>
                  </div>
                  
                  <div className="space-y-2.5 border-t border-border/40 pt-5">
                    <Label htmlFor="adminPassword" className="text-slate-700 dark:text-slate-300 font-medium">Admin Verification</Label>
                    <div className="relative">
                      <Input 
                        id="adminPassword" 
                        type={showAdminPassword ? "text" : "password"}
                        placeholder="Enter your admin password" 
                        value={adminPassword} 
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="pr-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" 
                      />
                      <button 
                        type="button" 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                      >
                        {showAdminPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 flex items-center">
                      <Lock className="h-3.5 w-3.5 mr-1" />
                      Restoring is a highly sensitive operation. Admin authentication is strictly required.
                    </p>
                  </div>
                </div>

                {isRestoring && (
                  <div className="border border-red-200 dark:border-red-800 rounded-md p-4 bg-red-50/50 dark:bg-red-950/20 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Restore Progress
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-red-600 dark:text-red-400">
                      <span>{restoreStatus}</span>
                    </div>
                  </div>
                )}
                
                {restoreStatus && !isRestoring && restoreStatus.includes("successful") && (
                  <div className="border border-green-200 dark:border-green-800 rounded-md p-4 bg-green-50/50 dark:bg-green-950/20 mt-4">
                    <div className="flex items-center space-x-3 text-sm text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{restoreStatus}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-center border-t border-border/40 p-5 bg-slate-50/50 dark:bg-slate-900/20">
                <Button 
                  size="lg"
                  onClick={() => {
                    if (!restoreFilePath) {
                      toast.error("Please provide a backup file path");
                      return;
                    }
                    if (!adminPassword) {
                      toast.error("Please provide your admin password to authorize the restore");
                      return;
                    }
                    setShowRestoreModal(true);
                  }} 
                  disabled={isRestoring || !restoreFilePath}
                  className="w-full max-w-md bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md hover:shadow-lg transition-all duration-300 font-semibold text-base py-6 rounded-xl"
                >
                  {isRestoring ? (
                    <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Restoring Database...</>
                  ) : (
                    <><RotateCcw className="mr-3 h-5 w-5" /> Confirm & Restore Database</>
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            {/* Restore Confirmation Modal */}
            <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-red-600 flex items-center">
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Confirm Database Restore
                  </DialogTitle>
                  <DialogDescription className="pt-2">
                    <div className="mb-2 text-slate-700 dark:text-slate-300 font-medium">
                      You are about to restore the database from:
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded text-xs break-all mb-4">
                      {restoreFilePath}
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-3 rounded-lg border border-red-200 dark:border-red-800 text-sm">
                      <span className="font-bold uppercase tracking-wider text-[11px] block mb-1">Critical Warning</span>
                      This action will <strong>completely overwrite</strong> your current database. A safety backup will be created automatically, but any unsaved changes may be lost.
                    </div>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setShowRestoreModal(false)} disabled={isRestoring}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowRestoreModal(false);
                      handleRestoreBackup();
                    }} 
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={isRestoring}
                  >
                    Confirm Restore
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <Card className="w-full">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4">
                <div>
                  <CardTitle>Full Backup History</CardTitle>
                  <CardDescription>A complete log of all manual and automatic backups across the entire lifespan of the system.</CardDescription>
                </div>
              </CardHeader>
              
              {/* Filters Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-4 border-b border-t gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  {["All", "Manual", "Automatic"].map(type => (
                    <Button 
                      key={type} 
                      variant={historyTypeFilter === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setHistoryTypeFilter(type); setHistoryPage(1); }}
                      className="rounded-full text-xs h-8"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={historyStatusFilter}
                    onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(1); }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>
                  
                  <div className="relative w-full sm:w-[250px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-9 h-9 w-full" 
                      placeholder="Search by name or date..." 
                      value={historySearchQuery}
                      onChange={(e) => { setHistorySearchQuery(e.target.value); setHistoryPage(1); }}
                    />
                  </div>
                </div>
              </div>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-900/50 dark:text-slate-300 border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-12">#</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Size</th>
                        <th className="px-4 py-3 font-semibold text-center w-[120px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredHistory = backupHistory.filter(b => {
                          const matchesSearch = b.BackupName.toLowerCase().includes(historySearchQuery.toLowerCase()) || format(new Date(b.CreatedAt + "Z"), "dd MMM yyyy").toLowerCase().includes(historySearchQuery.toLowerCase());
                          const matchesType = historyTypeFilter === "All" || b.BackupType === historyTypeFilter;
                          const matchesStatus = historyStatusFilter === "All" || b.Status === historyStatusFilter;
                          return matchesSearch && matchesType && matchesStatus;
                        });
                        
                        const totalItems = filteredHistory.length;
                        const totalPages = Math.ceil(totalItems / historyPageSize);
                        const paginatedHistory = filteredHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

                        if (totalItems === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                No backup history found matching your filters.
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <>
                            {paginatedHistory.map((backup, index) => (
                              <tr key={backup.BackupId} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                <td className="px-4 py-3 text-slate-500">{(historyPage - 1) * historyPageSize + index + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                  {format(new Date(backup.CreatedAt + "Z"), "dd MMM yyyy, hh:mm a")}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{backup.BackupName}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{backup.BackupType}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${backup.Status === "Success" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                                    {backup.Status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">{formatBytes(backup.SizeBytes)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center justify-center space-x-1">
                                    {backup.Status === "Success" && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        onClick={() => {
                                          setRestoreFilePath(`${backup.BackupLocation}/${backup.BackupName}`.replace(/\\/g, '/'));
                                          onTabChange("restore");
                                        }}
                                        title="Restore"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => handleVerifyBackup(backup.BackupId)} title="Verify">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleOpenFolder(backup.BackupId)} title="Open Folder">
                                      <FolderOpen className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDeleteBackup(backup.BackupId)} title="Delete">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {/* Pagination */}
                            {totalItems > 0 && (
                              <tr className="bg-transparent border-t">
                                <td colSpan={7} className="px-4 py-4">
                                  <div className="flex items-center justify-between w-full">
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                      Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{(historyPage - 1) * historyPageSize + 1}</span> - <span className="font-semibold text-slate-900 dark:text-slate-100">{Math.min(historyPage * historyPageSize, totalItems)}</span> of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span> backups
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        disabled={historyPage === 1}
                                        className="h-8 text-xs font-medium"
                                      >
                                        Previous
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                        disabled={historyPage === totalPages}
                                        className="h-8 text-xs font-medium"
                                      >
                                        Next
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <Card className="shadow-sm border-border/60 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-border/40 pb-5">
                <CardTitle className="text-lg flex items-center text-slate-800 dark:text-slate-200">
                  <Settings className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Automatic Backup Settings
                </CardTitle>
                <CardDescription>
                  Configure background schedules, retention policies, and startup events for automatic backups.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                
                {/* Master Toggle */}
                <div className={cn(
                  "p-4 rounded-xl border transition-all duration-300 flex items-start space-x-3",
                  settings.IsAutoBackupEnabled 
                    ? "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm" 
                    : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                )}>
                  <div className="mt-0.5">
                    <Checkbox 
                      id="autoBackup" 
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:text-white border-slate-300"
                      checked={settings.IsAutoBackupEnabled} 
                      onCheckedChange={(c) => setSettings({ ...settings, IsAutoBackupEnabled: c as boolean })} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="autoBackup" className={cn(
                      "font-bold text-base cursor-pointer",
                      settings.IsAutoBackupEnabled ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-300"
                    )}>
                      Enable Automatic Scheduled Backups
                    </Label>
                    <p className={cn(
                      "text-sm mt-1",
                      settings.IsAutoBackupEnabled ? "text-blue-700/80 dark:text-blue-300/80" : "text-muted-foreground"
                    )}>
                      Turn this on to let the system automatically secure your database in the background.
                    </p>
                  </div>
                </div>
                
                <div className={cn(
                  "space-y-8 transition-opacity duration-300", 
                  !settings.IsAutoBackupEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'
                )}>
                  
                  {/* Schedule Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center border-b border-border/40 pb-2">
                      <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                      Backup Schedule
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-1">
                      <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-400">Backup Frequency</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          value={settings.BackupFrequency}
                          onChange={(e) => setSettings({ ...settings, BackupFrequency: e.target.value })}
                          disabled={!settings.IsAutoBackupEnabled}
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-400">Time of Day</Label>
                        <Input 
                          type="time"
                          value={settings.BackupTime}
                          onChange={(e) => setSettings({ ...settings, BackupTime: e.target.value })}
                          disabled={!settings.IsAutoBackupEnabled}
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Storage Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center border-b border-border/40 pb-2">
                      <HardDrive className="h-4 w-4 mr-2 text-emerald-500" />
                      Storage &amp; Retention
                    </h4>
                    <div className="space-y-5 pl-1">
                      <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-400">Backup Location</Label>
                        <div className="flex space-x-2">
                          <Input 
                            value={settings.BackupLocation} 
                            onChange={(e) => setSettings({ ...settings, BackupLocation: e.target.value })} 
                            disabled={!settings.IsAutoBackupEnabled}
                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono text-sm"
                          />
                          <Button variant="outline" type="button" onClick={handleBrowseSettingsFolder} disabled={!settings.IsAutoBackupEnabled} className="shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <FolderOpen className="mr-2 h-4 w-4 text-blue-500"/> Browse
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-400">Retention Policy (Max backups to keep)</Label>
                        <Input 
                          type="number"
                          min={1}
                          max={100}
                          value={settings.RetentionCount}
                          onChange={(e) => setSettings({ ...settings, RetentionCount: parseInt(e.target.value) || 7 })}
                          disabled={!settings.IsAutoBackupEnabled}
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1 flex items-center">
                          <Info className="h-3.5 w-3.5 mr-1" />
                          Older automatic backups will be safely deleted to save disk space.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center border-b border-border/40 pb-2">
                      <ShieldCheck className="h-4 w-4 mr-2 text-rose-500" />
                      Advanced Security
                    </h4>
                    <div className="space-y-4 pl-1">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="compressAuto" 
                          checked={settings.CompressBackup} 
                          onCheckedChange={(c) => setSettings({ ...settings, CompressBackup: c as boolean })} 
                          disabled={!settings.IsAutoBackupEnabled}
                          className="mt-0.5"
                        />
                        <div>
                          <Label htmlFor="compressAuto" className="text-sm font-medium cursor-pointer">Compress to ZIP Archive</Label>
                          <p className="text-xs text-muted-foreground mt-1">Reduces storage size by compressing the SQLite file.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="autoVerify" 
                          checked={settings.AutoVerify} 
                          onCheckedChange={(c) => setSettings({ ...settings, AutoVerify: c as boolean })} 
                          disabled={!settings.IsAutoBackupEnabled}
                          className="mt-0.5 data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=checked]:border-green-600"
                        />
                        <div>
                          <Label htmlFor="autoVerify" className="text-sm font-medium cursor-pointer text-green-700 dark:text-green-500">Run Deep Verification after backup (AES-256 + Integrity)</Label>
                          <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-1">Ensures the backup was fully successful and is cryptographically verifiable.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Events - Always active */}
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center pb-2">
                    <Settings className="h-4 w-4 mr-2 text-slate-500" />
                    System Events
                  </h4>
                  <div className="flex items-start space-x-3 pl-1">
                    <Checkbox 
                      id="startupBackup" 
                      checked={settings.BackupOnStartup} 
                      onCheckedChange={(c) => setSettings({ ...settings, BackupOnStartup: c as boolean })} 
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor="startupBackup" className="text-sm font-medium cursor-pointer">Backup on Application Startup</Label>
                      <p className="text-xs text-muted-foreground mt-1">Automatically create a backup when the software starts. (24-hour cooldown prevents spam)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-center border-t border-border/40 p-5 bg-slate-50/50 dark:bg-slate-900/20">
                <Button 
                  size="lg"
                  onClick={handleSaveSettings} 
                  disabled={isSavingSettings}
                  className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 font-semibold text-base py-6 rounded-xl"
                >
                  {isSavingSettings ? (
                    <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Saving Configuration...</>
                  ) : (
                    <><CheckCircle2 className="mr-3 h-5 w-5" /> Save Backup Configuration</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        {/* ── Available Backups Sidebar ────────────────────────────────────── */}
        {activeTab !== "history" && (
          <div className="space-y-6">
            <Card className="h-full shadow-sm border-border/60">
              <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-bold flex items-center">
                    <History className="h-5 w-5 mr-2 text-indigo-500" />
                    Available Backups
                  </CardTitle>
                  <div className="flex space-x-1">
                    <div className="relative group">
                      <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground opacity-50 group-focus-within:opacity-100 transition-opacity" />
                      <Input 
                        className="h-8 w-[180px] pl-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-full" 
                        placeholder="Search backups..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-3 py-4">
                {isLoadingHistory ? (
                  <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-blue-500" />
                    <span className="text-sm font-medium">Loading history...</span>
                  </div>
                ) : backupHistory.filter(b => b.BackupName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 m-2">
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-full mb-3">
                      <Database className="h-6 w-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No backups found</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Create a manual backup to get started.</p>
                  </div>
                ) : (
                  backupHistory.filter(b => b.BackupName.toLowerCase().includes(searchQuery.toLowerCase())).map((backup) => (
                    <div
                      key={backup.BackupId}
                      className={cn(
                        "relative group border rounded-lg p-3 transition-all cursor-pointer",
                        selectedBackupId === backup.BackupId 
                          ? "border-blue-500 bg-blue-50/20 dark:bg-blue-900/10 shadow-sm"
                          : "hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-card"
                      )}
                      onMouseEnter={() => setHoveredBackupId(backup.BackupId)}
                      onMouseLeave={() => setHoveredBackupId(null)}
                      onClick={() => {
                        setSelectedBackupId(backup.BackupId);
                        const ext = backup.IsCompressed === false ? ".sqlite" : ".zip";
                        setRestoreFilePath(`${backup.BackupLocation}/${backup.BackupName}${ext}`.replace(/\\/g, '/'));
                      }}
                    >
                      {/* Info row */}
                      <div className="flex items-start gap-2.5 pointer-events-none">
                        <div className={cn(
                          "p-1.5 rounded-md shrink-0 mt-0.5",
                          selectedBackupId === backup.BackupId ? "bg-blue-100 dark:bg-blue-900/40" : "bg-blue-50 dark:bg-blue-900/20"
                        )}>
                          <Database className="h-4 w-4 text-blue-600" />
                        </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate" title={backup.BackupName}>{backup.BackupName}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(backup.CreatedAt + "Z"), "dd MMM yyyy · hh:mm a")}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground">{formatBytes(backup.SizeBytes)}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-muted-foreground">{backup.BackupType}</span>
                          {backup.Status === "Success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto shrink-0" />}
                        </div>
                      </div>
                    </div>

                    {/* Hover quick-action buttons */}
                    <div className={cn(
                      "flex gap-1.5 mt-2.5 transition-all duration-150",
                      hoveredBackupId === backup.BackupId ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
                    )}>
                      {backup.Status === "Success" && (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            setRestoreFilePath(`${backup.BackupLocation}/${backup.BackupName}`.replace(/\\/g, '/'));
                            onTabChange("restore");
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2"
                        title="Open Folder"
                        onClick={() => handleOpenFolder(backup.BackupId)}
                      >
                        <FolderOpen className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Delete"
                        onClick={() => handleDeleteBackup(backup.BackupId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              <Button variant="ghost" className="w-full text-blue-600 text-sm mt-2" onClick={() => onTabChange("history")}>
                View All Backups <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
      </>
      )}

      {/* ── Verify Modal ─────────────────────────────────────────────────── */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-xl w-full max-w-lg">
            <h3 className="text-xl font-bold mb-2 flex items-center">
              <ShieldCheck className="mr-2 h-6 w-6 text-blue-500" /> Deep Verification Engine
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Executing AES-256 decryption and internal structure traversal via SQLite C-engine.
            </p>
            
            <div className="space-y-4">
              {/* Checksum Stage */}
              <div className="flex items-start space-x-4 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50">
                <div className="mt-0.5">
                  {isVerifying && !verificationReport ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : 
                   verificationReport?.report?.checksum?.status === "Passed" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                   <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xs">X</div>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Stage 1: Cryptographic Checksum</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {verificationReport?.report?.checksum?.message || "Reading physical file in 64KB chunks to calculate SHA-256..."}
                  </p>
                </div>
              </div>

              {/* Integrity Stage */}
              <div className="flex items-start space-x-4 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50">
                <div className="mt-0.5">
                  {isVerifying && !verificationReport ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : 
                   verificationReport?.report?.integrity?.status === "Passed" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                   verificationReport?.report?.integrity?.status === "Skipped" ? <Info className="h-5 w-5 text-yellow-500" /> :
                   <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xs">X</div>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Stage 2: AES-256 Decryption &amp; B-Tree Integrity</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {verificationReport?.report?.integrity?.message || "Decrypting using HWID key and running PRAGMA integrity_check..."}
                  </p>
                </div>
              </div>

              {/* Schema Stage */}
              <div className="flex items-start space-x-4 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50">
                <div className="mt-0.5">
                  {isVerifying && !verificationReport ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : 
                   verificationReport?.report?.schema?.status === "Passed" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                   <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xs">X</div>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Stage 3: Schema Validation</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {verificationReport?.report?.schema?.message || "Comparing alembic_version between backup and live database..."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setIsVerifyModalOpen(false)} disabled={isVerifying} className={verificationReport?.overall === "Passed" ? "bg-green-600 hover:bg-green-700 text-white" : ""}>
                {isVerifying ? "Verifying..." : "Close Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
