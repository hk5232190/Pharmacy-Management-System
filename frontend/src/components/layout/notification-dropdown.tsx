"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ArrowRight,
  PackageX,
  AlertTriangle,
  CalendarX,
  CalendarClock,
  ShieldAlert,
  Database,
  ExternalLink,
  Clock,
  Sparkles
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface NotificationItem {
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

export function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const res = await apiClient.get("/notifications/unread-count");
      if (res && typeof res.unread_count === "number") {
        setUnreadCount(res.unread_count);
      }
    } catch {
      // ignore
    }
  };

  // Fetch latest 10 notifications for dropdown
  const fetchLatestNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/notifications/latest");
      if (res && res.items) {
        setNotifications(res.items);
        setUnreadCount(res.unread_count ?? 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load & periodic poll every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    // Global listener so other parts of the app can refresh the bell
    const handleGlobalRefresh = () => {
      fetchUnreadCount();
      if (isOpen) {
        fetchLatestNotifications();
      }
    };
    window.addEventListener("refresh-notifications", handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-notifications", handleGlobalRefresh);
    };
  }, [isOpen]);

  // When opening dropdown, fetch latest items
  useEffect(() => {
    if (isOpen) {
      fetchLatestNotifications();
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle Mark All Read
  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await apiClient.put("/notifications/read-all");
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      window.dispatchEvent(new CustomEvent("refresh-notifications"));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Handle Item Click (Mark Read + Navigate)
  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.IsRead) {
      try {
        await apiClient.put(`/notifications/${notif.NotificationId}/read`);
        setNotifications(prev =>
          prev.map(n => (n.NotificationId === notif.NotificationId ? { ...n, IsRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        window.dispatchEvent(new CustomEvent("refresh-notifications"));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    setIsOpen(false);
    if (notif.ActionUrl) {
      router.push(notif.ActionUrl);
    } else {
      router.push("/dashboard/notifications");
    }
  };

  // Helper for type-specific icons and colors
  const getNotificationVisuals = (type: string, priority: string) => {
    switch (type) {
      case "OUT_OF_STOCK":
        return {
          icon: PackageX,
          iconColor: "text-rose-600 dark:text-rose-400",
          bgColor: "bg-rose-50 dark:bg-rose-950/40",
          borderColor: "border-rose-200 dark:border-rose-900/40",
          badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
        };
      case "LOW_STOCK":
        return {
          icon: AlertTriangle,
          iconColor: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-50 dark:bg-amber-950/40",
          borderColor: "border-amber-200 dark:border-amber-900/40",
          badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        };
      case "EXPIRED_MEDICINE":
        return {
          icon: CalendarX,
          iconColor: "text-rose-600 dark:text-rose-400",
          bgColor: "bg-rose-50 dark:bg-rose-950/40",
          borderColor: "border-rose-200 dark:border-rose-900/40",
          badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
        };
      case "EXPIRING_SOON":
        return {
          icon: CalendarClock,
          iconColor: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-50 dark:bg-amber-950/40",
          borderColor: "border-amber-200 dark:border-amber-900/40",
          badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        };
      case "LICENSE_ALERT":
        return {
          icon: ShieldAlert,
          iconColor: "text-indigo-600 dark:text-indigo-400",
          bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
          borderColor: "border-indigo-200 dark:border-indigo-900/40",
          badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
        };
      case "BACKUP_SUCCESS":
        return {
          icon: Database,
          iconColor: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
          borderColor: "border-emerald-200 dark:border-emerald-900/40",
          badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        };
      case "BACKUP_FAILED":
        return {
          icon: Database,
          iconColor: "text-rose-600 dark:text-rose-400",
          bgColor: "bg-rose-50 dark:bg-rose-950/40",
          borderColor: "border-rose-200 dark:border-rose-900/40",
          badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
        };
      default:
        return {
          icon: Bell,
          iconColor: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-50 dark:bg-blue-950/40",
          borderColor: "border-blue-200 dark:border-blue-900/40",
          badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        };
    }
  };

  // Helper for relative time formatting
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        className={cn(
          "relative p-2 rounded-xl transition-all duration-200 outline-none",
          isOpen
            ? "bg-secondary text-foreground ring-2 ring-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        <Bell className="w-[1.2rem] h-[1.2rem]" />

        {/* Live Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white shadow-xs animate-in zoom-in-75">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-slate-50/70 dark:bg-secondary/30 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {unreadCount} new
                  </span>
                )}
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/60 custom-scrollbar">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Checking live notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 border border-emerald-100 dark:border-emerald-900/30">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">All Caught Up!</h4>
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  No active stock alerts, expired medicines, or pending system notifications.
                </p>
              </div>
            ) : (
              notifications.map(notif => {
                const visuals = getNotificationVisuals(notif.Type, notif.Priority);
                const IconComponent = visuals.icon;
                const relTime = formatRelativeTime(notif.CreatedAt);

                return (
                  <div
                    key={notif.NotificationId}
                    onClick={() => handleItemClick(notif)}
                    className={cn(
                      "flex items-start gap-3 p-3.5 transition-colors cursor-pointer group text-left",
                      notif.IsRead
                        ? "bg-card hover:bg-secondary/60 opacity-85 hover:opacity-100"
                        : "bg-primary/[0.03] hover:bg-primary/[0.07] dark:bg-primary/[0.05] dark:hover:bg-primary/[0.1]"
                    )}
                  >
                    {/* Visual Icon Badge */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 transition-transform group-hover:scale-105",
                        visuals.bgColor,
                        visuals.borderColor
                      )}
                    >
                      <IconComponent className={cn("w-4 h-4", visuals.iconColor)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span
                          className={cn(
                            "text-xs font-bold truncate",
                            notif.IsRead ? "text-foreground/90" : "text-foreground"
                          )}
                          title={notif.Title}
                        >
                          {notif.Title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {relTime}
                          </span>
                          {!notif.IsRead && (
                            <span
                              className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                              title="Unread"
                            />
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notif.Message}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                            visuals.badgeColor
                          )}
                        >
                          {notif.Priority}
                        </span>

                        <span className="text-primary font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          View details
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex items-center justify-center">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/notifications");
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-foreground hover:text-primary hover:bg-secondary rounded-xl transition-all"
            >
              <span>View All Notifications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
