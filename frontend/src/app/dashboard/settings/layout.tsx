"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ReceiptText, Package, Settings as SettingsIcon, Paintbrush, ShieldCheck, Info, Printer, Shield, RefreshCcw, Check, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1500);
    }, 600);
  };

  const navigation = [
    { name: "Pharmacy Information", href: "/dashboard/settings/profile", icon: Building2 },
    { name: "Billing & POS Settings", href: "/dashboard/settings/billing", icon: ReceiptText },
    { name: "Inventory & Medicine Settings", href: "/dashboard/settings/inventory", icon: Package },
    { name: "Printer & Receipt Settings", href: "/dashboard/settings/printer", icon: Printer },
    { name: "Appearance & System Preferences", href: "/dashboard/settings/appearance", icon: Paintbrush },
    { name: "Security & Maintenance", href: "/dashboard/settings/security", icon: Shield },
    { name: "Backup & Data Management", href: "/dashboard/settings/backup", icon: Database },
    { name: "License Information", href: "/dashboard/settings/license", icon: ShieldCheck },
    { name: "About Software", href: "/dashboard/settings/about", icon: Info },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col p-6 pb-2 border-b">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure your pharmacy, personalize the application, and manage system preferences.</p>
          </div>
          <Button
            variant="outline"
            className={cn(
              "h-9 gap-2 transition-all duration-300 rounded-full",
              refreshState === "loading" && "border-primary/40 text-primary",
              refreshState === "done" && "border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20"
            )}
            onClick={handleRefresh}
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
        <div className="flex items-center space-x-2 text-sm text-slate-500 mt-4">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-slate-900 dark:text-white font-medium">Settings</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <aside className="w-80 border-r bg-white dark:bg-slate-950 overflow-y-auto hidden md:block">
          <nav className="p-4 space-y-2">
          {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center p-3 rounded-lg transition-all ${
                    isActive 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm" 
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
                  <p className={`ml-3 text-sm font-semibold ${isActive ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
                    {item.name}
                  </p>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main key={refreshKey} className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
