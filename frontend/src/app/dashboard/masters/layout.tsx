"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Pill, Grid2X2, Building2, Truck, Users, RefreshCcw, Check, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// ── KPI Card — balanced proportions ─────────────────────────────────────────
const accentMap: Record<
  string,
  {
    border: string;
    icon: string;
    text: string;
    bg: string;
    iconBorder: string;
  }
> = {
  blue: {
    border: "border-l-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50/80 dark:bg-blue-950/40",
    iconBorder: "border-blue-100 dark:border-blue-900/30",
  },
  emerald: {
    border: "border-l-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/40",
    iconBorder: "border-emerald-100 dark:border-emerald-900/30",
  },
  purple: {
    border: "border-l-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
    text: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50/80 dark:bg-purple-950/40",
    iconBorder: "border-purple-100 dark:border-purple-900/30",
  },
  orange: {
    border: "border-l-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50/80 dark:bg-orange-950/40",
    iconBorder: "border-orange-100 dark:border-orange-900/30",
  },
  cyan: {
    border: "border-l-cyan-500",
    icon: "text-cyan-600 dark:text-cyan-400",
    text: "text-cyan-700 dark:text-cyan-400",
    bg: "bg-cyan-50/80 dark:bg-cyan-950/40",
    iconBorder: "border-cyan-100 dark:border-cyan-900/30",
  },
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
        "group relative bg-white dark:bg-card rounded-xl border border-border/80 border-l-[4px] shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-4.5 flex flex-col justify-between min-h-[142px] overflow-hidden",
        a.border,
        href && "cursor-pointer hover:border-border hover:-translate-y-0.5 active:translate-y-0"
      )}
    >
      {/* Icon block & hover affordance */}
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 shadow-2xs",
            a.bg,
            a.iconBorder
          )}
        >
          <Icon size={20} className={a.icon} />
        </div>
        {href && (
          <span className="text-muted-foreground/30 group-hover:text-muted-foreground/75 transition-colors p-1 rounded-md">
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        )}
      </div>

      {/* Metric */}
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1 truncate" title={title}>
          {title}
        </p>
        <p className={cn("text-2xl font-black leading-none tabular-nums tracking-tight", a.text)}>
          {value}
        </p>
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

  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    await fetchCounts();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("refresh-masters-tab"));
    }
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1500);
    }, 400);
  };

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
            ? (medsRes.value.total ?? medsRes.value.data?.length ?? 0)
            : 0,
        categories:
          catsRes.status === "fulfilled" && catsRes.value?.success
            ? (catsRes.value.total ?? catsRes.value.data?.length ?? 0)
            : 0,
        companies:
          comsRes.status === "fulfilled" && comsRes.value?.success
            ? (comsRes.value.total ?? comsRes.value.data?.length ?? 0)
            : 0,
        suppliers:
          suppRes.status === "fulfilled" && suppRes.value?.success
            ? (suppRes.value.total ?? suppRes.value.data?.length ?? 0)
            : 0,
        customers:
          custRes.status === "fulfilled" && custRes.value?.success
            ? (custRes.value.total ?? custRes.value.data?.length ?? 0)
            : 0,
      });
    } catch {
      // silently fail — counts stay 0
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
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
      <div key={refreshKey} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {children}
      </div>

    </div>
  );
}
