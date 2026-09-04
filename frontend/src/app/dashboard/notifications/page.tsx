"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  PackageX,
  AlertTriangle,
  CalendarX,
  CalendarClock,
  ShieldAlert,
  Database,
  ExternalLink,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Layers,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Activity,
  SlidersHorizontal,
  ChevronRight as ChevronRightIcon,
  HelpCircle,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface NotificationItem {
  NotificationId: number;
  Type: string;
  Title: string;
  Message: string;
  Priority: "Low" | "Normal" | "High" | "Critical";
  RelatedModule?: string;
  RelatedRecordId?: string;
  EntityKey?: string;
  ActionUrl?: string;
  IsRead: boolean;
  CreatedAt: string;
}

type CategoryTab = "all" | "unread" | "stock" | "expiry" | "license" | "backup";

export default function NotificationCenterPage() {
  const router = useRouter();

  // Filters and state
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Data
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load notifications from API
  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        page_size: pageSize.toString()
      };

      if (activeTab === "unread") {
        params.status = "unread";
      } else if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      if (activeTab !== "all" && activeTab !== "unread") {
        params.category = activeTab;
      }

      if (priorityFilter !== "all") {
        params.priority = priorityFilter;
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await apiClient.get("/notifications", { params });

      if (res && res.items) {
        setNotifications(res.items);
        setTotalItems(res.total ?? 0);
        setUnreadCount(res.unread_count ?? 0);
        setTotalPages(res.total_pages ?? 1);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, pageSize, activeTab, priorityFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  // Sync / Refresh
  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiClient.post("/notifications/sync", {});
      await fetchNotifications(true);
      window.dispatchEvent(new CustomEvent("refresh-notifications"));
      showToast("Notifications synchronized with live database state");
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Mark single as read
  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(id);
      await apiClient.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.NotificationId === id ? { ...n, IsRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent("refresh-notifications"));
      showToast("Marked as read");
    } catch (err) {
      console.error("Error marking as read:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await apiClient.put("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent("refresh-notifications"));
      showToast("All notifications marked as read");
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  // Delete single notification
  const handleDeleteNotification = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(id);
      await apiClient.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.NotificationId !== id));
      setTotalItems(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent("refresh-notifications"));
      showToast("Notification deleted");
    } catch (err) {
      console.error("Error deleting notification:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Clear all read notifications
  const handleClearRead = async () => {
    try {
      const res = await apiClient.delete("/notifications/clear-read");
      fetchNotifications();
      window.dispatchEvent(new CustomEvent("refresh-notifications"));
      showToast(res?.message || "Read notifications cleared successfully");
    } catch (err) {
      console.error("Error clearing read:", err);
    }
  };

  // Dynamic KPI calculations
  const stats = useMemo(() => {
    const criticalCount = notifications.filter(
      n => n.Priority === "Critical" || n.Priority === "High"
    ).length;

    const stockCount = notifications.filter(
      n => n.Type === "OUT_OF_STOCK" || n.Type === "LOW_STOCK"
    ).length;

    const expiryCount = notifications.filter(
      n => n.Type === "EXPIRED_MEDICINE" || n.Type === "EXPIRING_SOON"
    ).length;

    const licenseCount = notifications.filter(
      n => n.Type === "LICENSE_ALERT"
    ).length;

    const backupCount = notifications.filter(
      n => n.Type === "BACKUP_SUCCESS" || n.Type === "BACKUP_FAILED"
    ).length;

    return {
      total: totalItems,
      unread: unreadCount,
      critical: criticalCount,
      read: Math.max(0, totalItems - unreadCount),
      stockCount,
      expiryCount,
      licenseCount,
      backupCount
    };
  }, [notifications, totalItems, unreadCount]);

  // Visual helper
  const getVisuals = (type: string) => {
    switch (type) {
      case "OUT_OF_STOCK":
        return {
          icon: PackageX,
          iconColor: "text-rose-600 dark:text-rose-400",
          bgColor: "bg-rose-50 dark:bg-rose-950/40",
          iconBorder: "border-rose-100 dark:border-rose-900/30",
          borderAccent: "border-l-rose-500",
          tag: "Out of Stock",
          tagColor: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800"
        };
      case "LOW_STOCK":
        return {
          icon: AlertTriangle,
          iconColor: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-50 dark:bg-amber-950/40",
          iconBorder: "border-amber-100 dark:border-amber-900/30",
          borderAccent: "border-l-amber-500",
          tag: "Low Stock Alert",
          tagColor: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
        };
      case "EXPIRED_MEDICINE":
        return {
          icon: CalendarX,
          iconColor: "text-rose-600 dark:text-rose-400",
          bgColor: "bg-rose-50 dark:bg-rose-950/40",
          iconBorder: "border-rose-100 dark:border-rose-900/30",
          borderAccent: "border-l-rose-600",
          tag: "Expired Medicine",
          tagColor: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800"
        };
      case "EXPIRING_SOON":
        return {
          icon: CalendarClock,
          iconColor: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-50 dark:bg-amber-950/40",
          iconBorder: "border-amber-100 dark:border-amber-900/30",
          borderAccent: "border-l-amber-500",
          tag: "Expiring Soon",
          tagColor: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
        };
      case "LICENSE_ALERT":
        return {
          icon: ShieldAlert,
          iconColor: "text-indigo-600 dark:text-indigo-400",
          bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
          iconBorder: "border-indigo-100 dark:border-indigo-900/30",
          borderAccent: "border-l-indigo-500",
          tag: "License Alert",
          tagColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
        };
      case "BACKUP_SUCCESS":
        return {
          icon: Database,
          iconColor: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
          iconBorder: "border-emerald-100 dark:border-emerald-900/30",
          borderAccent: "border-l-emerald-500",
          tag: "Backup Success",
          tagColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
        };
      case "BACKUP_FAILED":
        return {
          icon: Database,
          iconColor: "text-rose-600 dark:text-rose-400",
          bgColor: "bg-rose-50 dark:bg-rose-950/40",
          iconBorder: "border-rose-100 dark:border-rose-900/30",
          borderAccent: "border-l-rose-500",
          tag: "Backup Failed",
          tagColor: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800"
        };
      default:
        return {
          icon: Bell,
          iconColor: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-50 dark:bg-blue-950/40",
          iconBorder: "border-blue-100 dark:border-blue-900/30",
          borderAccent: "border-l-blue-500",
          tag: "System Alert",
          tagColor: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
        };
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return {
          badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
          dot: "bg-rose-500"
        };
      case "High":
        return {
          badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
          dot: "bg-amber-500"
        };
      case "Normal":
        return {
          badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
          dot: "bg-blue-500"
        };
      default:
        return {
          badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
          dot: "bg-slate-400"
        };
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 172800) return "Yesterday";
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4 duration-200 border border-border">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* ── Page Header (Aligned with Masters & Inventory Style) ─────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notification Center</h1>
          <p className="text-muted-foreground mt-1 text-[15px]">
            Live PMS inventory threshold alerts, medicine expiry monitors, and system event audits.
          </p>

          {/* Breadcrumbs */}
          <div className="flex items-center text-sm text-slate-500 mt-2.5">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
            <ChevronRightIcon className="w-4 h-4 mx-1" />
            <span className="text-foreground font-medium">Notifications</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-9 px-3.5 rounded-full font-bold text-xs gap-2 border-border shadow-xs hover:bg-secondary transition-all"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-primary", syncing && "animate-spin")} />
            <span>{syncing ? "Scanning..." : "Sync Alerts"}</span>
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-9 px-3.5 rounded-full font-bold text-xs gap-2 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-950/30 shadow-xs transition-all"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearRead}
            className="h-9 px-3.5 rounded-full font-bold text-xs gap-2 text-muted-foreground hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/40 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 shadow-xs transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Read</span>
          </Button>
        </div>
      </div>

      {/* ── Top 4 Stat Cards: Responsive CSS Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total Alerts */}
        <div className="bg-white dark:bg-card border border-border border-l-4 border-l-blue-500 rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[132px] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-blue-500">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
              System Total
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Total Alerts
            </p>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 leading-none tabular-nums">
              {stats.total.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 2: Unread Alerts */}
        <div className="bg-white dark:bg-card border border-border border-l-4 border-l-rose-500 rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[132px] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 flex items-center justify-center text-rose-500">
              <Bell className="w-5 h-5" />
            </div>
            {stats.unread > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
                Needs Review
              </span>
            ) : (
              <span className="text-[11px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                Zero Pending
              </span>
            )}
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Unread Alerts
            </p>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 leading-none tabular-nums">
              {stats.unread.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 3: Critical & High Alerts */}
        <div className="bg-white dark:bg-card border border-border border-l-4 border-l-orange-500 rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[132px] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 flex items-center justify-center text-orange-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
              High Priority
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Critical & Urgent
            </p>
            <p className="text-2xl font-extrabold text-orange-600 dark:text-orange-400 leading-none tabular-nums">
              {stats.critical.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 4: 90-Day Auto Purge */}
        <div className="bg-white dark:bg-card border border-border border-l-4 border-l-emerald-500 rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[132px] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              SQLite Native
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              90-Day Auto Purge
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">
              Auto-Managed
            </p>
          </div>
        </div>
      </div>

      {/* ── Category Navigation Tabs (Matches Masters & Settings design) ──── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-px overflow-x-auto custom-scrollbar">
        {[
          { id: "all", label: "All Alerts", icon: Layers, count: totalItems },
          { id: "unread", label: "Unread", icon: Bell, count: unreadCount },
          { id: "stock", label: "Stock Alerts", icon: PackageX },
          { id: "expiry", label: "Expiry Tracking", icon: CalendarClock },
          { id: "license", label: "License & System", icon: ShieldAlert },
          { id: "backup", label: "Backups", icon: Database }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as CategoryTab);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-semibold text-[14px] transition-all relative border border-transparent shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <IconComp className={cn("w-4 h-4", isActive ? "" : "text-slate-400")} />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 text-[11px] rounded-full font-bold ml-0.5",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-secondary text-foreground border border-border"
                  )}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <div className="absolute -bottom-px left-0 w-full h-[2px] bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main Two-Column Responsive Layout (12-Column Scaffolding) ─────── */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column: Alerts Feed */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Filter & Search Bar with Responsive Wrapping */}
          <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] sm:min-w-[280px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-xs rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus:bg-background transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns with flex-wrap gap-2.5 */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {activeTab !== "unread" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50/70 dark:bg-secondary/30 px-3 py-1.5 rounded-xl border border-border">
                  <span className="font-semibold">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="text-xs font-bold bg-transparent outline-none cursor-pointer text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50/70 dark:bg-secondary/30 px-3 py-1.5 rounded-xl border border-border">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-semibold">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={e => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs font-bold bg-transparent outline-none cursor-pointer text-foreground"
                >
                  <option value="all">All</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50/70 dark:bg-secondary/30 px-3 py-1.5 rounded-xl border border-border">
                <span className="font-semibold">Show:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="text-xs font-bold bg-transparent outline-none cursor-pointer text-foreground"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications Card Feed */}
          <div className="space-y-3.5">
            {loading ? (
              <div className="py-24 bg-white dark:bg-card rounded-2xl border border-border flex flex-col items-center justify-center text-center text-muted-foreground gap-3 shadow-xs">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">Scanning PMS notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-24 px-6 rounded-2xl border border-dashed border-border bg-white dark:bg-card text-center flex flex-col items-center justify-center shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3.5 border border-emerald-100 dark:border-emerald-900/30">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-foreground mb-1">
                  No Notifications Found
                </h3>
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                  {activeTab !== "all" || priorityFilter !== "all" || debouncedSearch
                    ? "No alerts match your current search and category filters. Try resetting filters."
                    : "Your system has zero pending alerts! Inventory levels are healthy, no medicines are expired, and software licenses are valid."}
                </p>
                {(activeTab !== "all" || priorityFilter !== "all" || debouncedSearch || statusFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs font-bold rounded-xl h-9"
                    onClick={() => {
                      setActiveTab("all");
                      setPriorityFilter("all");
                      setStatusFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            ) : (
              notifications.map(notif => {
                const visuals = getVisuals(notif.Type);
                const priorityBadge = getPriorityBadge(notif.Priority);
                const IconComp = visuals.icon;
                const isActing = actionLoadingId === notif.NotificationId;

                return (
                  <div
                    key={notif.NotificationId}
                    className={cn(
                      "group relative rounded-2xl border border-l-[5px] transition-all duration-200 p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5",
                      visuals.borderAccent,
                      notif.IsRead
                        ? "bg-white/80 dark:bg-card/80 border-border/70 opacity-90 hover:opacity-100"
                        : "bg-white dark:bg-card border-border ring-1 ring-primary/10"
                    )}
                  >
                    {/* Top Row: Icon + Badges + Title */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Visual Icon Badge */}
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 shadow-2xs",
                            visuals.bgColor,
                            visuals.iconBorder
                          )}
                        >
                          <IconComp className={cn("w-6 h-6", visuals.iconColor)} />
                        </div>

                        {/* Title & Tags */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {/* Category Tag */}
                            <span
                              className={cn(
                                "text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border tracking-wide uppercase",
                                visuals.tagColor
                              )}
                            >
                              {visuals.tag}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={cn(
                                "flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                priorityBadge.badge
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", priorityBadge.dot)} />
                              {notif.Priority}
                            </span>

                            {/* Status Tag */}
                            {!notif.IsRead ? (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                                Unread
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                Reviewed
                              </span>
                            )}
                          </div>

                          <h3
                            className={cn(
                              "text-base font-extrabold tracking-tight truncate",
                              notif.IsRead ? "text-foreground/90" : "text-foreground"
                            )}
                            title={notif.Title}
                          >
                            {notif.Title}
                          </h3>
                        </div>
                      </div>

                      {/* Relative Time Badge */}
                      <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 shrink-0 bg-slate-50 dark:bg-secondary/40 px-2.5 py-1 rounded-full border border-border/80">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                        <span>{formatRelativeTime(notif.CreatedAt)}</span>
                      </div>
                    </div>

                    {/* Middle Message Body */}
                    <div className="mt-3 pl-0 md:pl-16 text-sm text-muted-foreground leading-relaxed">
                      {notif.Message}
                    </div>

                    {/* Bottom Metadata & Action Toolbar */}
                    <div className="mt-4 pt-3.5 border-t border-border/70 flex flex-wrap items-center justify-between gap-3 pl-0 md:pl-16">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Logged: <strong className="text-foreground/90">{formatTimestamp(notif.CreatedAt)}</strong>
                        </span>
                        {notif.RelatedModule && (
                          <span className="px-2 py-0.5 rounded bg-secondary/80 text-[10px] font-mono font-bold uppercase text-muted-foreground">
                            {notif.RelatedModule}
                          </span>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 ml-auto">
                        {notif.ActionUrl && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!notif.IsRead) handleMarkAsRead(notif.NotificationId);
                              router.push(notif.ActionUrl!);
                            }}
                            className="h-8.5 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all"
                          >
                            <span>Take Action</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {!notif.IsRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isActing}
                            onClick={e => handleMarkAsRead(notif.NotificationId, e)}
                            className="h-8.5 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl border-border hover:bg-secondary transition-all"
                            title="Mark as Read"
                          >
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            <span>Read</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActing}
                          onClick={e => handleDeleteNotification(notif.NotificationId, e)}
                          className="h-8.5 w-8.5 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                          title="Delete Notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-card rounded-2xl border border-border shadow-xs">
              <p className="text-xs text-muted-foreground font-medium">
                Showing <strong className="text-foreground">{Math.min((page - 1) * pageSize + 1, totalItems)}</strong> to{" "}
                <strong className="text-foreground">{Math.min(page * pageSize, totalItems)}</strong> of{" "}
                <strong className="text-foreground">{totalItems}</strong> notifications
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="h-8.5 px-3 text-xs font-bold rounded-xl"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>

                <span className="px-3.5 py-1 text-xs font-extrabold text-foreground bg-secondary/80 rounded-xl border border-border">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-8.5 px-3 text-xs font-bold rounded-xl"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Information & Monitoring Widgets */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Widget 1: Categories Breakdown */}
          <div className="bg-white dark:bg-card rounded-2xl border border-border p-4.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                Alert Categories
              </h3>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Live Overview
              </span>
            </div>

            <div className="space-y-1.5">
              {[
                { id: "stock", label: "Inventory Stock Alerts", icon: PackageX, count: stats.stockCount, color: "text-amber-600 dark:text-amber-400" },
                { id: "expiry", label: "Medicine Expiry Alerts", icon: CalendarClock, count: stats.expiryCount, color: "text-rose-600 dark:text-rose-400" },
                { id: "license", label: "License & System Audits", icon: ShieldAlert, count: stats.licenseCount, color: "text-indigo-600 dark:text-indigo-400" },
                { id: "backup", label: "Database Backup Logs", icon: Database, count: stats.backupCount, color: "text-emerald-600 dark:text-emerald-400" }
              ].map(cat => {
                const Icon = cat.icon;
                const isCurrent = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveTab(cat.id as CategoryTab);
                      setPage(1);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all text-left",
                      isCurrent
                        ? "bg-primary/10 text-primary font-bold border border-primary/20"
                        : "hover:bg-secondary/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={cn("w-4 h-4 shrink-0", cat.color)} />
                      <span className="truncate">{cat.label}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-background border border-border shrink-0 ml-1.5">
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Widget 2: System Health & Automation Status */}
          <div className="bg-white dark:bg-card rounded-2xl border border-border p-4.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Engine Diagnostics
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                Operational
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>90-Day Auto Purge</span>
                <span className="font-bold text-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  SQLite Native
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Ghost Prevention</span>
                <span className="font-bold text-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Stateful Sync
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Background Refresh</span>
                <span className="font-bold text-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Every 30s
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Audit Deletions</span>
                <span className="font-bold text-foreground">SRS Chapter 6</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <Link
                href="/dashboard/settings/appearance"
                className="flex items-center justify-between text-xs font-semibold text-primary hover:text-primary/80 transition-colors pt-1"
              >
                <span className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  Alert & Audio Settings
                </span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Widget 3: Helpful Alert Guidelines */}
          <div className="bg-slate-50/70 dark:bg-secondary/20 rounded-2xl border border-border p-4.5 space-y-2 text-xs text-muted-foreground">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              Quick Reference
            </h4>
            <p className="leading-relaxed">
              Condition alerts (low stock, expiry, license) automatically resolve when conditions are fixed (e.g. restocking medicine or renewing license).
            </p>
            <p className="leading-relaxed text-[11px] text-muted-foreground/80">
              Notification deletions are logged in <code className="font-mono text-foreground font-semibold">app_audit.log</code> per compliance requirements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
