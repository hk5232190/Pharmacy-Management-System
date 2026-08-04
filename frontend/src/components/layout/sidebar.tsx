"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  PlusSquare
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Masters",
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
    title: "Sales",
    icon: TrendingUp,
    href: "/dashboard/sales",
  },
  {
    title: "Inventory",
    icon: Package,
    href: "/dashboard/inventory",
  },
  {
    title: "Accounts",
    icon: Wallet,
    href: "/dashboard/accounts",
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/dashboard/reports",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
  },
  {
    title: "Utilities",
    icon: Wrench,
    href: "/dashboard/utilities",
  }
];

export function Sidebar() {
  const pathname = usePathname();
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
      <div className="h-16 flex items-center px-6 bg-white dark:bg-slate-950 border-b border-border shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg flex items-center justify-center">
            <PlusSquare size={22} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[17px] leading-tight text-foreground tracking-tight">Pharmacy</span>
            <span className="text-[10px] text-muted-foreground leading-tight tracking-wide uppercase">Management System</span>
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
      <div className="p-4 shrink-0 border-t border-slate-800">
        <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white w-full py-2 px-3 hover:bg-slate-800/50 rounded-lg transition-colors mb-4">
          <ChevronRight className="w-4 h-4 rotate-180" /> Collapse
        </button>
        <div className="px-3 text-[11px] text-slate-500 leading-relaxed">
          © 2025 PMS Software<br />
          All rights reserved.
        </div>
      </div>
    </aside>
  );
}
