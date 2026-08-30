"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ReceiptText, Package, Settings as SettingsIcon, Bell, ShieldCheck, Info, Printer, Shield, RefreshCcw, Check, Database, User as UserIcon } from "lucide-react";
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
    { name: "General Settings", href: "/dashboard/settings/general", icon: SettingsIcon },
    { name: "My Profile", href: "/dashboard/settings/my-profile", icon: UserIcon },
    { name: "Pharmacy Information", href: "/dashboard/settings/profile", icon: Building2 },
    { name: "Billing & POS Settings", href: "/dashboard/settings/billing", icon: ReceiptText },
    { name: "Inventory & Medicine Settings", href: "/dashboard/settings/inventory", icon: Package },
    { name: "Printer & Receipt Settings", href: "/dashboard/settings/printer", icon: Printer },
    { name: "Notification Settings", href: "/dashboard/settings/appearance", icon: Bell },
    { name: "Security & Maintenance", href: "/dashboard/settings/security", icon: Shield },
    { name: "License Information", href: "/dashboard/settings/license", icon: ShieldCheck },
    { name: "About Software", href: "/dashboard/settings/about", icon: Info },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0a]">
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

      <div className="flex flex-1 overflow-hidden p-6 gap-8 bg-slate-50/50 dark:bg-[#0a0a0a]">
        {/* Settings Sidebar */}
        <aside className="w-80 shrink-0 hidden md:block">
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
        <main key={refreshKey} className="flex-1 overflow-y-auto custom-scrollbar pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
