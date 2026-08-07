"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  ShoppingCart,
  TrendingUp,
  Package,
  Wallet,
  BarChart3,
  Settings,
  Wrench,
  ChevronDown,
  ChevronRight,
  Pill,
  Grid2X2,
  Building2,
  Truck,
  Users,
  PlusSquare,
  Database,
  LogOut
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Master Data",
    icon: Layers,
    href: "/dashboard/masters",
    subItems: [
      { title: "Medicines", icon: Pill, href: "/dashboard/masters/medicines" },
      { title: "Categories", icon: Grid2X2, href: "/dashboard/masters/categories" },
      { title: "Companies", icon: Building2, href: "/dashboard/masters/companies" },
      { title: "Suppliers", icon: Truck, href: "/dashboard/masters/suppliers" },
      { title: "Customers", icon: Users, href: "/dashboard/masters/customers" },
    ]
  },
  {
    title: "Purchases",
    icon: ShoppingCart,
    href: "/dashboard/purchases",
  },
  {
    title: "Inventory",
    icon: Package,
    href: "/dashboard/inventory",
  },
  {
    title: "Sales & POS Billing",
    icon: TrendingUp,
    href: "/dashboard/sales",
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/dashboard/reports",
  },
  {
    title: "Backup & Restore",
    icon: Database,
    href: "/dashboard/backup",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    router.push("/");
  };

  // Manage open states for items with sub-menus. By default, open if the current path matches.
  const [openStates, setOpenStates] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    NAV_ITEMS.forEach(item => {
      if (item.subItems) {
        initialState[item.title] = pathname.startsWith(item.href);
      }
    });
    return initialState;
  });

  const toggleOpen = (title: string) => {
    setOpenStates(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full overflow-hidden shrink-0 border-r border-slate-800">
      {/* Brand Logo Header */}
      <div className="min-h-[64px] py-3 flex items-center px-6 bg-white dark:bg-slate-950 border-b border-border shadow-sm shrink-0">
        <div className="flex items-center gap-3 w-full">
          {profile.LogoPath ? (
            <div className="h-8 w-8 flex items-center justify-center shrink-0">
              <img src={`http://127.0.0.1:8000${profile.LogoPath}`} alt="Logo" className="max-h-full max-w-full object-contain drop-shadow-sm" />
            </div>
          ) : (
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg flex items-center justify-center shrink-0">
              <PlusSquare className="h-6 w-6" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-bold text-[17px] leading-tight text-slate-900 dark:text-white break-words">
              {profile.PharmacyName || "Pharmacy"}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isOpen = openStates[item.title];

            return (
              <div key={item.title}>
                {hasSubItems ? (
                  <button
                    onClick={() => toggleOpen(item.title)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                      isActive 
                        ? "text-white" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-slate-500 group-hover:text-slate-300")} />
                      {item.title}
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-slate-500 group-hover:text-slate-300")} />
                    {item.title}
                  </Link>
                )}

                {/* Sub Items */}
                {hasSubItems && isOpen && (
                  <div className="mt-1 mb-2 space-y-1">
                    {item.subItems!.map((subItem) => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href);
                      return (
                        <Link
                          key={subItem.title}
                          href={subItem.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ml-4",
                            isSubActive 
                              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                          )}
                        >
                          <subItem.icon className={cn("w-4 h-4", isSubActive ? "text-primary-foreground/80" : "text-slate-500")} />
                          {subItem.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 shrink-0 border-t border-slate-800 mt-auto">
        <button 
          onClick={handleLogout}
          className="flex items-center justify-start gap-3 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-300 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:-translate-y-0.5"
        >
          <LogOut className="w-4 h-4 shrink-0" /> 
          Logout
        </button>
      </div>
    </aside>
  );
}
