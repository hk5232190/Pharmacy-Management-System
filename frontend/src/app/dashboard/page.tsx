"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import WidgetsSection from "./widgets-section";
import DashboardFilter from "./dashboard-filter";
import { toast } from "sonner";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  PackageSearch,
  Activity,
  ArrowRightLeft,
  Package,
  AlertTriangle,
  AlertCircle,
  Clock,
  Pill,
  Users,
  Truck,
  Skull,
  TrendingUp,
  Download,
  Wallet,
  RefreshCcw,
  Check
} from "lucide-react";

// ─── KPI Card (matches Inventory Management design) ────────────────────────
const accentMap: Record<string, { border: string; icon: string; text: string; bg: string }> = {
  blue:    { border: "border-l-blue-500",    icon: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
  purple:  { border: "border-l-purple-500",  icon: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
  emerald: { border: "border-l-emerald-500", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  rose:    { border: "border-l-rose-500",    icon: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
  orange:  { border: "border-l-orange-500",  icon: "text-orange-500",  text: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-900/20" },
  amber:   { border: "border-l-amber-500",   icon: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
  teal:    { border: "border-l-teal-500",    icon: "text-teal-500",    text: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-50 dark:bg-teal-900/20" },
  indigo:  { border: "border-l-indigo-500",  icon: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-900/20" },
};

function DashKPICard({
  title,
  value,
  icon,
  accent = "blue",
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  const a = accentMap[accent] ?? accentMap.blue;
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md",
        a.border,
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-95"
      )}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.bg)}>
        <span className={a.icon}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
        <p className={cn("text-2xl font-extrabold leading-none tabular-nums truncate", a.text)}>{value}</p>
      </div>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

export default function DashboardPageWrapper() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  
  const handleRefresh = () => {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1500);
    }, 400);
  };

  return <DashboardPageInner key={refreshKey} refreshState={refreshState} onRefresh={handleRefresh} />;
}

function DashboardPageInner({ onRefresh, refreshState }: { onRefresh: () => void, refreshState: "idle" | "loading" | "done" }) {
  const router = useRouter();
  const { formatNumber } = useSystemPreferences();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [timeframe, setTimeframe] = useState("today");
  const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'today': return "Today's";
      case 'week': return "This Week's";
      case 'month': return "This Month's";
      case 'year': return "This Year's";
      case 'custom': return "Custom Range";
      default: return "Today's";
    }
  };

  useEffect(() => {
    // Don't fetch if custom is selected but no date range has been applied yet
    if (timeframe === 'custom' && !dateRange) return;
    fetchSummary();
  }, [timeframe, dateRange]);

  const fetchSummary = async (showRefreshSpinner = false) => {
    setLoading(true);

    try {
      let url = `/dashboard/summary?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load dashboard data");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching dashboard summary");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex justify-center items-center h-screen bg-background text-muted-foreground">
        <div className="animate-pulse flex flex-col items-center">
          <Activity className="w-12 h-12 mb-4 animate-spin text-blue-500" />
          <h2 className="text-lg font-medium">Loading Dashboard Data...</h2>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex-1 space-y-8 p-8 bg-slate-50/50 dark:bg-background min-h-screen">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Live metrics from your pharmacy operations</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            className={cn(
              "h-9 gap-2 transition-all duration-300 rounded-full",
              refreshState === "loading" && "border-primary/40 text-primary",
              refreshState === "done" && "border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20"
            )}
            onClick={onRefresh}
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
      </div>

      {/* ROW 1: Filtered Business */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
          <DashboardFilter
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
        </div>

        {/* KPI Cards — Row 1: Period-filtered metrics */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <DashKPICard
            title={`${getTimeframeLabel()} Sales`}
            value={`Rs ${formatNumber(data.today_sales)}`}
            icon={<DollarSign className="h-6 w-6" />}
            accent="blue"
            onClick={() => router.push('/dashboard/sales')}
          />
          <DashKPICard
            title={`${getTimeframeLabel()} Purchases`}
            value={`Rs ${formatNumber(data.today_purchases)}`}
            icon={<PackageSearch className="h-6 w-6" />}
            accent="purple"
            onClick={() => router.push('/dashboard/purchases')}
          />
          <DashKPICard
            title={`${getTimeframeLabel()} Profit`}
            value={`Rs ${formatNumber(data.today_profit)}`}
            icon={<TrendingUp className="h-6 w-6" />}
            accent="emerald"
            onClick={() => router.push('/dashboard/reports')}
          />
          <DashKPICard
            title="Expired Medicines"
            value={data.expired_medicines}
            icon={<Skull className="h-6 w-6" />}
            accent="rose"
            onClick={() => router.push('/dashboard/inventory?tab=expiry')}
          />
          <DashKPICard
            title="Net Profit (All Time)"
            value={`Rs ${formatNumber(data.net_profit)}`}
            icon={<TrendingUp className="h-6 w-6" />}
            accent="teal"
            onClick={() => router.push('/dashboard/reports')}
          />
        </div>

        {/* KPI Cards — Row 2: Stock & All-Time */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <DashKPICard
            title="Low Stock"
            value={data.low_stock_count}
            icon={<AlertTriangle className="h-6 w-6" />}
            accent="orange"
            onClick={() => router.push('/dashboard/inventory?tab=current&status=Low%20Stock')}
          />
          <DashKPICard
            title="Out of Stock"
            value={data.out_of_stock_count}
            icon={<AlertCircle className="h-6 w-6" />}
            accent="rose"
            onClick={() => router.push('/dashboard/inventory?tab=current&status=Out%20of%20Stock')}
          />
          <DashKPICard
            title="Expiring Soon"
            value={data.expiring_soon_count}
            icon={<Clock className="h-6 w-6" />}
            accent="amber"
            onClick={() => router.push('/dashboard/inventory?tab=expiry')}
          />
          <DashKPICard
            title="Total Sales (All Time)"
            value={`Rs ${formatNumber(data.total_sales)}`}
            icon={<DollarSign className="h-6 w-6" />}
            accent="blue"
            onClick={() => router.push('/dashboard/reports')}
          />
          <DashKPICard
            title="Total Purchases (All Time)"
            value={`Rs ${formatNumber(data.total_purchases)}`}
            icon={<Download className="h-6 w-6" />}
            accent="indigo"
            onClick={() => router.push('/dashboard/reports')}
          />
        </div>
      </div>

      <WidgetsSection timeframe={timeframe} dateRange={dateRange} refreshTrigger={refreshTrigger} />
    </div>
  );
}

