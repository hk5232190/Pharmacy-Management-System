"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Pill, Grid2X2, Building2, Truck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

const TABS = [
  { name: "Medicines", icon: Pill, href: "/dashboard/masters/medicines" },
  { name: "Categories", icon: Grid2X2, href: "/dashboard/masters/categories" },
  { name: "Companies", icon: Building2, href: "/dashboard/masters/companies" },
  { name: "Suppliers", icon: Truck, href: "/dashboard/masters/suppliers" },
  { name: "Customers", icon: Users, href: "/dashboard/masters/customers" },
];

interface MastersCounts {
  medicines: number;
  categories: number;
  companies: number;
  suppliers: number;
  customers: number;
}

// ── KPI Card — matches Inventory Management design ─────────────────────────
const accentMap: Record<string, { border: string; icon: string; text: string; bg: string }> = {
  blue:    { border: "border-l-blue-500",    icon: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
  emerald: { border: "border-l-emerald-500", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  purple:  { border: "border-l-purple-500",  icon: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
  orange:  { border: "border-l-orange-500",  icon: "text-orange-500",  text: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-900/20" },
  cyan:    { border: "border-l-cyan-500",    icon: "text-cyan-500",    text: "text-cyan-600 dark:text-cyan-400",       bg: "bg-cyan-50 dark:bg-cyan-900/20" },
};

function MastersKPICard({
  icon: Icon,
  title,
  value,
  accent,
  href,
}: {
  icon: any;
  title: string;
  value: string;
  accent: string;
  href?: string;
}) {
  const a = accentMap[accent] ?? accentMap.blue;

  const card = (
    <div
      className={cn(
        "relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md",
        a.border,
        href && "cursor-pointer hover:scale-[1.02] active:scale-95"
      )}
    >
      {/* Icon block */}
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.bg)}>
        <Icon size={22} className={a.icon} />
      </div>
      {/* Metric */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
        <p className={cn("text-2xl font-extrabold leading-none tabular-nums", a.text)}>{value}</p>
      </div>
    </div>
  );

  return href ? <Link href={href} className="block">{card}</Link> : card;
}
// ──────────────────────────────────────────────────────────────────────────

export default function MastersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<MastersCounts>({
    medicines: 0,
    categories: 0,
    companies: 0,
    suppliers: 0,
    customers: 0,
  });

  useEffect(() => {
    fetchCounts();
  }, []);

  // Re-fetch counts whenever the active tab changes so additions/deletions
  // in one tab are reflected in the summary strip immediately.
  useEffect(() => {
    fetchCounts();
  }, [pathname]);

  const fetchCounts = async () => {
    try {
      const [medsRes, catsRes, comsRes, suppRes, custRes] = await Promise.allSettled([
        apiClient.get("/medicines"),
        apiClient.get("/categories"),
        apiClient.get("/companies"),
        apiClient.get("/suppliers"),
        apiClient.get("/customers"),
      ]);

      setCounts({
        medicines:
          medsRes.status === "fulfilled" && medsRes.value?.success
            ? (medsRes.value.data?.length ?? medsRes.value.data?.total ?? 0)
            : 0,
        categories:
          catsRes.status === "fulfilled" && catsRes.value?.success
            ? (catsRes.value.data?.length ?? 0)
            : 0,
        companies:
          comsRes.status === "fulfilled" && comsRes.value?.success
            ? (comsRes.value.data?.length ?? 0)
            : 0,
        suppliers:
          suppRes.status === "fulfilled" && suppRes.value?.success
            ? (suppRes.value.data?.length ?? 0)
            : 0,
        customers:
          custRes.status === "fulfilled" && custRes.value?.success
            ? (custRes.value.data?.length ?? 0)
            : 0,
      });
    } catch {
      // silently fail — counts stay 0
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Masters</h1>
        <p className="text-muted-foreground mt-1 text-[15px]">
          Create and maintain all reference data used throughout the pharmacy system.
        </p>

        {/* Breadcrumbs */}
        <div className="flex items-center text-sm text-slate-500 mt-4">
          <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="w-4 h-4 mx-1" />
          <span className="text-foreground font-medium">Masters</span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MastersKPICard
          icon={Pill}
          title="Total Medicines"
          value={counts.medicines.toLocaleString()}
          accent="blue"
          href="/dashboard/masters/medicines"
        />
        <MastersKPICard
          icon={Grid2X2}
          title="Categories"
          value={counts.categories.toLocaleString()}
          accent="emerald"
          href="/dashboard/masters/categories"
        />
        <MastersKPICard
          icon={Building2}
          title="Companies"
          value={counts.companies.toLocaleString()}
          accent="purple"
          href="/dashboard/masters/companies"
        />
        <MastersKPICard
          icon={Truck}
          title="Suppliers"
          value={counts.suppliers.toLocaleString()}
          accent="orange"
          href="/dashboard/masters/suppliers"
        />
        <MastersKPICard
          icon={Users}
          title="Customers"
          value={counts.customers.toLocaleString()}
          accent="cyan"
          href="/dashboard/masters/customers"
        />
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

      {/* Main Tab Content */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {children}
      </div>

    </div>
  );
}
