"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Pill, Grid2X2, Building2, Truck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "Medicines", icon: Pill, href: "/dashboard/masters/medicines" },
  { name: "Categories", icon: Grid2X2, href: "/dashboard/masters/categories" },
  { name: "Companies", icon: Building2, href: "/dashboard/masters/companies" },
  { name: "Suppliers", icon: Truck, href: "/dashboard/masters/suppliers" },
  { name: "Customers", icon: Users, href: "/dashboard/masters/customers" },
];

export default function MastersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-6 md:p-8 space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Masters</h1>
        <p className="text-muted-foreground mt-1 text-[15px]">Create and maintain all reference data used throughout the pharmacy system.</p>
        
        {/* Breadcrumbs */}
        <div className="flex items-center text-sm text-slate-500 mt-4">
          <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="w-4 h-4 mx-1" />
          <span className="text-foreground font-medium">Masters</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-px">
        {TABS.map(tab => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-t-xl font-semibold text-[15px] transition-all relative border border-transparent",
                isActive 
                  ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                  : "bg-card text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <tab.icon size={18} className={cn(isActive ? "" : "text-slate-400")} />
              {tab.name}
              {isActive && (
                <div className="absolute -bottom-px left-0 w-full h-[2px] bg-primary"></div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard icon={Pill} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400" title="Total Medicines" value="1,245" trend="+ 12 this month" />
        <SummaryCard icon={Grid2X2} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" title="Categories" value="18" trend="+ 2 this month" />
        <SummaryCard icon={Building2} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600 dark:text-purple-400" title="Companies" value="34" trend="+ 3 this month" />
        <SummaryCard icon={Truck} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600 dark:text-orange-400" title="Suppliers" value="22" trend="+ 1 this month" />
        <SummaryCard icon={Users} iconBg="bg-cyan-100 dark:bg-cyan-900/30" iconColor="text-cyan-600 dark:text-cyan-400" title="Customers" value="684" trend="+ 28 this month" />
      </div>

      {/* Main Tab Content */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {children}
      </div>

    </div>
  );
}

function SummaryCard({ icon: Icon, iconBg, iconColor, title, value, trend }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg, iconColor)}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-sm font-semibold text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold text-foreground mt-0.5">{value}</div>
        <div className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
          ↑ {trend.replace('+ ', '')}
        </div>
      </div>
    </div>
  );
}
