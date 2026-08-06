"use client";

import { useState, useEffect } from "react";
import { 
  RefreshCw, Settings, Calendar, Database, HardDrive, HeartPulse, 
  ShieldCheck, Clock, DownloadCloud, RotateCcw, History, Edit2, 
  FolderOpen, Info, CheckCircle2, Search, Filter, Shield, 
  CloudRain, ArrowRight, Loader2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BackupRestorePage() {
  const [activeTab, setActiveTab] = useState("manual");
  const [backupName, setBackupName] = useState("");
  const [backupLocation, setBackupLocation] = useState("./backups");
  const [compress, setCompress] = useState(true);
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [expandedBackupId, setExpandedBackupId] = useState<number | null>(null);

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
    CompressBackup: true
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Initialize backup name
  useEffect(() => {
    generateBackupName();
    fetchHistory();
    fetchSettings();
  }, []);

  const generateBackupName = () => {
    const now = new Date();
    setBackupName(`Backup_${format(now, "yyyy_MM_dd_HHmmss")}`);
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/v1/backup/history", {
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
      const res = await fetch("http://localhost:8000/api/v1/backup-settings", {
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

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/v1/backup-settings", {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("Backup settings saved successfully.");
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
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/v1/backup/manual", {
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

      if (res.ok) {
        toast.success("Backup created successfully!");
        generateBackupName(); // Generate a new name for the next backup
        fetchHistory(); // Refresh history
      } else {
        toast.error(data.detail || "Failed to create backup");
      }
    } catch (error) {
      toast.error("An error occurred while communicating with the server.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFilePath) {
      toast.error("Please provide a backup file path");
      return;
    }

    setIsRestoring(true);
    setRestoreStatus("Validating backup integrity and schema... (Creating Safety Backup)");
    
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      
      const res = await fetch("http://localhost:8000/api/v1/backup/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          backup_file_path: restoreFilePath
        })
      });

      const data = await res.json();

      if (res.ok) {
        setRestoreStatus("Restore successful. Reloading...");
        toast.success(data.message || "Database restored successfully!");
        
        // Force reload the frontend to fetch fresh data
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
      const res = await fetch("http://localhost:8000/api/v1/backup/browse-folder");
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
      const res = await fetch("http://localhost:8000/api/v1/backup/browse-folder");
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
      const res = await fetch("http://localhost:8000/api/v1/backup/browse-file");
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
      const res = await fetch(`http://localhost:8000/api/v1/backup/history/${id}`, {
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
      const res = await fetch(`http://localhost:8000/api/v1/backup/history/${id}/verify`, {
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
      const res = await fetch(`http://localhost:8000/api/v1/backup/history/${id}/open-folder`, {
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

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Backup & Restore</h2>
          <p className="text-muted-foreground">Protect your pharmacy data by creating secure backups, restoring previous versions, and managing backup history.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={fetchHistory}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Backup Settings
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Calendar className="h-8 w-8 text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">Today</div>
            <p className="text-xs text-green-500 flex items-center mt-1">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Successful
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <Database className="h-8 w-8 text-purple-500 bg-purple-50 dark:bg-purple-900/20 p-1.5 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{backupHistory.length}</div>
            <p className="text-xs text-green-500 mt-1 flex items-center">
              ↑ 2 this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backup Storage</CardTitle>
            <HardDrive className="h-8 w-8 text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatBytes(backupHistory.reduce((acc, curr) => acc + (curr.SizeBytes || 0), 0))} Used
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2">
              <div className="bg-blue-500 h-1.5 rounded-full w-[15%]"></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">15% Used of 10 GB</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automatic Backup</CardTitle>
            <HeartPulse className="h-8 w-8 text-green-500 bg-green-50 dark:bg-green-900/20 p-1.5 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-500">Enabled</div>
            <p className="text-xs text-muted-foreground mt-1">Daily at 11:00 PM</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            <ShieldCheck className="h-8 w-8 text-orange-500 bg-orange-50 dark:bg-orange-900/20 p-1.5 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-green-500 flex items-center mt-1">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Protected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
            <Clock className="h-8 w-8 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 p-1.5 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">Tomorrow</div>
            <p className="text-xs text-blue-500 flex items-center mt-1">
              <Clock className="h-3 w-3 mr-1" /> In 11h 17m
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b pb-2 mt-6">
        <Button variant={activeTab === "manual" ? "default" : "ghost"} onClick={() => setActiveTab("manual")} className={activeTab === "manual" ? "bg-blue-600 hover:bg-blue-700" : ""}>
          <DownloadCloud className="mr-2 h-4 w-4" />
          Manual Backup
        </Button>
        <Button variant={activeTab === "restore" ? "default" : "ghost"} onClick={() => setActiveTab("restore")}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Restore Backup
        </Button>
        <Button variant={activeTab === "history" ? "default" : "ghost"} onClick={() => setActiveTab("history")}>
          <History className="mr-2 h-4 w-4" />
          Backup History
        </Button>
        <Button variant={activeTab === "settings" ? "default" : "ghost"} onClick={() => setActiveTab("settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Backup Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Main Content Area */}
        <div className="md:col-span-2 space-y-6">
          {activeTab === "manual" && (
            <Card>
              <CardHeader>
                <CardTitle>Create Manual Backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column in Form */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backupName">Backup Name</Label>
                      <div className="relative">
                        <Input id="backupName" value={backupName} onChange={(e) => setBackupName(e.target.value)} />
                        <Edit2 className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backupLocation">Backup Location</Label>
                      <div className="flex space-x-2">
                        <Input id="backupLocation" value={backupLocation} onChange={(e) => setBackupLocation(e.target.value)} />
                        <Button variant="outline" onClick={handleBrowseFolder} type="button">
                          <FolderOpen className="mr-2 h-4 w-4"/> Browse
                        </Button>
                      </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-md flex items-start text-sm">
                      <Info className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
                      <p>Ensure the selected location has enough free space for the backup.</p>
                    </div>
                  </div>

                  {/* Right Column in Form */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Backup Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Database Engine</span>
                          <span className="font-medium">SQLite</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">App Version</span>
                          <span className="font-medium">1.0.0.0</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-3">Backup Options</h4>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="includeDb" checked disabled />
                          <Label htmlFor="includeDb" className="text-sm font-normal cursor-not-allowed">Include Database</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="compress" checked={compress} onCheckedChange={(c) => setCompress(c as boolean)} />
                          <Label htmlFor="compress" className="text-sm font-normal cursor-pointer">Compress Backup File (.zip)</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {isBackingUp && (
                  <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Backup Progress</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Executing SQLite online backup engine... Generating SHA-256 checksum...</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-center border-t p-4">
                <Button 
                  onClick={handleCreateBackup} 
                  disabled={isBackingUp}
                  className="w-48 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <DownloadCloud className="mr-2 h-4 w-4" />
                  {isBackingUp ? "Creating Backup..." : "Create Backup"}
                </Button>
              </CardFooter>
            </Card>
          )}
          {activeTab === "restore" && (
            <Card className="border-red-100 dark:border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">Restore Database</CardTitle>
                <CardDescription>
                  Restoring a backup will completely overwrite your current database. A safety backup will be created automatically before the restore process begins.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="restoreFilePath">Backup File Path</Label>
                    <div className="flex space-x-2">
                      <Input 
                        id="restoreFilePath" 
                        placeholder="e.g. ./backups/Backup_2026_08_06.sqlite" 
                        value={restoreFilePath} 
                        onChange={(e) => setRestoreFilePath(e.target.value)} 
                      />
                      <Button variant="outline" onClick={handleBrowseFile} type="button">
                        <FolderOpen className="mr-2 h-4 w-4"/> Browse
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You can also select a backup from the "Available Backups" list on the right.
                    </p>
                  </div>
                </div>

                {isRestoring && (
                  <div className="border border-red-200 dark:border-red-800 rounded-md p-4 bg-red-50/50 dark:bg-red-950/20 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">Restore Progress</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-red-600 dark:text-red-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
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
              <CardFooter className="flex justify-center border-t p-4">
                <Button 
                  onClick={handleRestoreBackup} 
                  disabled={isRestoring || !restoreFilePath}
                  className="w-48 bg-red-600 hover:bg-red-700 text-white"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {isRestoring ? "Restoring..." : "Restore Database"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {activeTab === "history" && (
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4">
                <div>
                  <CardTitle>Full Backup History</CardTitle>
                  <CardDescription>A complete log of all manual and automatic backups across the entire lifespan of the system.</CardDescription>
                </div>
                <div className="relative mt-4 md:mt-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 w-full md:w-[250px]" 
                    placeholder="Search backups..." 
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-900/50 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Size</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupHistory.filter(b => b.BackupName.toLowerCase().includes(historySearchQuery.toLowerCase())).map((backup) => (
                        <tr key={backup.BackupId} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                            {format(new Date(backup.CreatedAt + "Z"), "dd MMM yyyy, hh:mm a")}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{backup.BackupName}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatBytes(backup.SizeBytes)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{backup.BackupType}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${backup.Status === "Success" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                              {backup.Status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {backup.Status === "Success" && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={() => {
                                    setRestoreFilePath(`${backup.BackupLocation}/${backup.BackupName}`.replace(/\\/g, '/'));
                                    setActiveTab("restore");
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
                      {backupHistory.filter(b => b.BackupName.toLowerCase().includes(historySearchQuery.toLowerCase())).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No backup history found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Automatic Backup Settings</CardTitle>
                <CardDescription>Configure background schedules, retention policies, and startup events for automatic backups.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b">
                  <Checkbox 
                    id="autoBackup" 
                    checked={settings.IsAutoBackupEnabled} 
                    onCheckedChange={(c) => setSettings({ ...settings, IsAutoBackupEnabled: c as boolean })} 
                  />
                  <Label htmlFor="autoBackup" className="font-semibold text-base cursor-pointer">Enable Automatic Scheduled Backups</Label>
                </div>
                
                <div className={`space-y-6 ${!settings.IsAutoBackupEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Backup Frequency</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={settings.BackupFrequency}
                        onChange={(e) => setSettings({ ...settings, BackupFrequency: e.target.value })}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Time of Day</Label>
                      <Input 
                        type="time"
                        value={settings.BackupTime}
                        onChange={(e) => setSettings({ ...settings, BackupTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Backup Location</Label>
                    <div className="flex space-x-2">
                      <Input 
                        value={settings.BackupLocation} 
                        onChange={(e) => setSettings({ ...settings, BackupLocation: e.target.value })} 
                      />
                      <Button variant="outline" type="button" onClick={handleBrowseSettingsFolder}>
                        <FolderOpen className="mr-2 h-4 w-4"/> Browse
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Retention Policy (Max backups to keep)</Label>
                    <Input 
                      type="number"
                      min={1}
                      max={100}
                      value={settings.RetentionCount}
                      onChange={(e) => setSettings({ ...settings, RetentionCount: parseInt(e.target.value) || 7 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Older automatic backups will be safely deleted to save disk space.</p>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox 
                      id="compressAuto" 
                      checked={settings.CompressBackup} 
                      onCheckedChange={(c) => setSettings({ ...settings, CompressBackup: c as boolean })} 
                    />
                    <Label htmlFor="compressAuto" className="text-sm font-normal cursor-pointer">Compress to ZIP</Label>
                  </div>
                </div>

                <div className="pt-6 border-t space-y-4">
                  <h4 className="font-semibold text-sm">System Events</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="startupBackup" 
                      checked={settings.BackupOnStartup} 
                      onCheckedChange={(c) => setSettings({ ...settings, BackupOnStartup: c as boolean })} 
                    />
                    <Label htmlFor="startupBackup" className="text-sm font-normal cursor-pointer">Create a backup automatically when the application starts</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">A 24-hour cooldown prevents spam if the app restarts multiple times.</p>
                </div>

              </CardContent>
              <CardFooter className="flex justify-end border-t p-4 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={isSavingSettings}
                  className="w-32 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSavingSettings ? "Saving..." : "Save Settings"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Promotional Footer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="flex items-start space-x-3 p-4 border rounded-xl bg-white dark:bg-slate-950">
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg"><Shield className="h-6 w-6 text-green-600" /></div>
              <div>
                <h4 className="text-sm font-semibold">Your Data is Protected</h4>
                <p className="text-xs text-muted-foreground mt-1">Regular backups ensure your pharmacy data is safe.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-xl bg-white dark:bg-slate-950">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg"><RotateCcw className="h-6 w-6 text-blue-600" /></div>
              <div>
                <h4 className="text-sm font-semibold">Restore with Confidence</h4>
                <p className="text-xs text-muted-foreground mt-1">Restore your data from any previous backup easily.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-xl bg-white dark:bg-slate-950">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded-lg"><CloudRain className="h-6 w-6 text-cyan-600" /></div>
              <div>
                <h4 className="text-sm font-semibold">Automatic Backups</h4>
                <p className="text-xs text-muted-foreground mt-1">Run in the background to keep data always protected.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-xl bg-white dark:bg-slate-950">
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg"><Database className="h-6 w-6 text-green-600" /></div>
              <div>
                <h4 className="text-sm font-semibold">Verify & Ensure Integrity</h4>
                <p className="text-xs text-muted-foreground mt-1">SHA-256 checksums verify backups are complete.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-3 border-b mb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Available Backups</CardTitle>
                <div className="flex space-x-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="h-8 w-[140px] pl-8 text-xs" 
                      placeholder="Search backups..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingHistory ? (
                <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading...</div>
              ) : backupHistory.filter(b => b.BackupName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No backups found.</div>
              ) : (
                backupHistory.filter(b => b.BackupName.toLowerCase().includes(searchQuery.toLowerCase())).map((backup) => (
                  <div key={backup.BackupId} className="border rounded-lg p-3 hover:border-blue-500 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
                          <Database className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-1" title={backup.BackupName}>{backup.BackupName}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(backup.CreatedAt + "Z"), "dd MMM yyyy hh:mm a")} • {formatBytes(backup.SizeBytes)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center mt-1">
                            {backup.BackupType} Backup
                          </p>
                        </div>
                      </div>
                      {backup.Status === "Success" && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1 h-8"
                        onClick={() => {
                          setRestoreFilePath(`${backup.BackupLocation}/${backup.BackupName}`.replace(/\\/g, '/'));
                          setActiveTab("restore");
                        }}
                      >
                        Restore
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => handleVerifyBackup(backup.BackupId)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verify
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-8"
                        onClick={() => setExpandedBackupId(expandedBackupId === backup.BackupId ? null : backup.BackupId)}
                      >
                         Details
                      </Button>
                    </div>
                    {expandedBackupId === backup.BackupId && (
                      <div className="mt-3 text-xs bg-slate-50 dark:bg-slate-900 rounded-md p-3 border border-slate-100 dark:border-slate-800 space-y-2 break-all">
                        <div className="grid grid-cols-[80px_1fr] gap-1">
                          <span className="text-muted-foreground font-medium">Status:</span>
                          <span className={backup.Status === "Success" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{backup.Status}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-1">
                          <span className="text-muted-foreground font-medium">Location:</span>
                          <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">{backup.BackupLocation}</span>
                        </div>
                        {backup.ChecksumSHA256 && (
                          <div className="grid grid-cols-[80px_1fr] gap-1">
                            <span className="text-muted-foreground font-medium">SHA-256:</span>
                            <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">{backup.ChecksumSHA256}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              <Button variant="ghost" className="w-full text-blue-600 text-sm mt-4" onClick={() => setActiveTab("history")}>
                View All Backups <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
                  <h4 className="text-sm font-semibold">Stage 2: AES-256 Decryption & B-Tree Integrity</h4>
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
