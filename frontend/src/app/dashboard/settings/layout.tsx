"use client";

import { ReactNode, useState, useEffect } from "react";
import { preload } from "swr";
import { apiClient, getApiBaseUrl } from "@/lib/api-client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ReceiptText, Package, Settings as SettingsIcon, ShieldCheck, Info, Shield, Database, User as UserIcon, Users, Printer, Check, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  /** If true, this tab is ONLY shown to admins, never to cashiers regardless of permissions. */
  adminOnly?: boolean;
  /** If true, this tab is shown to cashiers that have the 'settings' permission. */
  cashierAllowed?: boolean;
}

/** All settings navigation items. */
const ALL_NAV: NavItem[] = [
  { name: "General Settings",             href: "/dashboard/settings/general",       icon: SettingsIcon,  adminOnly: true },
  { name: "My Profile",                   href: "/dashboard/settings/my-profile",    icon: UserIcon,       cashierAllowed: true },
  { name: "Billing & POS Settings",       href: "/dashboard/settings/billing",       icon: ReceiptText,    adminOnly: true },
  { name: "Printer & Receipt",            href: "/dashboard/settings/printer",       icon: Printer,        adminOnly: true },
  { name: "Inventory & Medicine Settings",href: "/dashboard/settings/inventory",     icon: Package,        adminOnly: true },
  { name: "Security & Maintenance",       href: "/dashboard/settings/security",      icon: Shield,         adminOnly: true },
  { name: "Backup & Restore",             href: "/dashboard/settings/backup-restore",icon: Database,       cashierAllowed: true },
  { name: "Users",                        href: "/dashboard/settings/users",         icon: Users,          adminOnly: true },
  { name: "License Information",          href: "/dashboard/settings/license",       icon: ShieldCheck,    cashierAllowed: true },
  { name: "About Software",              href: "/dashboard/settings/about",          icon: Info,           cashierAllowed: true },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    // ── Preload Settings Endpoints ──────────────────────────────────────────
    // By preloading these endpoints in the background as soon as the user enters 
    // the settings layout, clicking on any settings tab becomes 100% instant 
    // because SWR will immediately serve the cached data without a spinner flash.
    
    const genericFetcher = async (url: string) => {
      const res = await apiClient.get<any>(url);
      if ((res as any).success === false) throw new Error((res as any).error);
      return res;
    };
    
    const dataFetcher = async (url: string) => {
      const res = await apiClient.get<any>(url);
      if (res.success === false) throw new Error("Failed");
      return res.data;
    };
    
    const osPrintersFetcher = async (url: string) => {
      const res = await apiClient.get<any>(url);
      if (res.success === false) throw new Error("Failed");
      return res.data || [];
    };

    const customAboutFetcher = async () => {
      const headers = { Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || ""}` };
      const [resAbout, resDiag, resLic] = await Promise.all([
        fetch(`${getApiBaseUrl()}/about/info`, { headers }),
        fetch(`${getApiBaseUrl()}/system/diagnostics`, { headers }).catch(() => null),
        fetch(`${getApiBaseUrl()}/license/info`, { headers }).catch(() => null)
      ]);
      
      if (!resAbout.ok) throw new Error("Failed");
      const aboutData = await resAbout.json();
      
      if (resLic && resLic.ok) {
        const licData = await resLic.json();
        aboutData.license = {
          status: licData.status,
          type: licData.license_type,
          expiry_date: licData.expiry_date,
          remaining_days: licData.remaining_days,
          is_lifetime: licData.total_days === null,
        };
      }
      
      const diagData = resDiag && resDiag.ok ? await resDiag.json() : null;
      return { aboutData, diagData };
    };

    // Backup & Restore
    preload('/backup/history', genericFetcher);
    preload('/backup-settings', genericFetcher);
    preload('/backup/db-info', genericFetcher);
    preload('/backup/db-health', genericFetcher);
    
    // Printer & Receipt
    preload('/settings/printer', genericFetcher);
    preload('/settings/billing', genericFetcher);
    preload('/settings/printer/list', osPrintersFetcher);

    // License
    preload('/license/info', dataFetcher);
    
    // About
    preload('/about/info', customAboutFetcher);
  }, []);

  // Build visible navigation based on role.
  // - Admins see everything.
  // - Cashiers see only items marked cashierAllowed: true.
  const isAdmin = user.role === "admin";
  const navigation = ALL_NAV.filter(item => {
    if (isAdmin) return true;
    return item.cashierAllowed === true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0a]">
      <div className="flex flex-col p-6 pb-2 border-b">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure your pharmacy, personalize the application, and manage system preferences.</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-500 mt-4">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-slate-900 dark:text-white font-medium">Settings</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-4 md:p-6 gap-4 md:gap-6 lg:gap-8 bg-slate-50/50 dark:bg-[#0a0a0a]">
        {/* Settings Sidebar */}
        <aside className="settings-sidebar-panel w-72 lg:w-80 shrink-0 hidden md:block">
          <div className="h-full rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none overflow-hidden flex flex-col relative transition-all duration-300">
            {/* Top decorative gradient line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-90"></div>
            <nav className="p-4 pt-6 space-y-1.5 overflow-y-auto custom-scrollbar flex-1">
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center p-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600 dark:bg-white text-white dark:text-black shadow-md shadow-blue-500/20 dark:shadow-none"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${isActive ? "text-white dark:text-black" : "text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110"}`} />
                    <p className={`ml-3.5 text-sm font-semibold tracking-tight ${isActive ? "text-white dark:text-black" : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"}`}>
                      {item.name}
                    </p>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
