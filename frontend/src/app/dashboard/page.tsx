"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
// Charts section removed
import WidgetsSection from "./widgets-section";
import DashboardFilter from "./dashboard-filter";
import { toast } from "sonner";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
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
  RefreshCw
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { formatNumber } = useSystemPreferences();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Global Filter State
  const [timeframe, setTimeframe] = useState("today");
  const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    if (showRefreshSpinner) setIsRefreshing(true);
    else setLoading(true);

    const startTime = Date.now();
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
        if (showRefreshSpinner) {
          toast.success("Dashboard successfully refreshed");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching dashboard summary");
    } finally {
      if (showRefreshSpinner) {
        const elapsed = Date.now() - startTime;
        if (elapsed < 600) {
          await new Promise(resolve => setTimeout(resolve, 600 - elapsed));
        }
      }
      setLoading(false);
      setIsRefreshing(false);
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
            onClick={() => {
              if (isRefreshing) return;
              fetchSummary(true);
              setRefreshTrigger(prev => prev + 1);
            }}
            variant="outline"
            disabled={isRefreshing}
            className="rounded-full shadow-sm bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-slate-900 border-border active:scale-95 transition-all duration-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin text-blue-500' : 'text-slate-500 dark:text-slate-400'}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Dashboard'}
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
        {/* KPI Cards: 2 rows × 5 cols — single grid ensures equal row heights */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 auto-rows-fr">
          {/* ── Row 1 ── */}
          <Card 
            onClick={() => router.push('/dashboard/sales')}
            className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-blue-200 dark:hover:border-blue-900 hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-[#111827] dark:text-gray-200">{getTimeframeLabel()} Sales</h3>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#111827] dark:text-white tracking-tight mt-1 truncate">Rs {formatNumber(data.today_sales)}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/purchases')}
            className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-purple-200 dark:hover:border-purple-900 hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-[#111827] dark:text-gray-200">{getTimeframeLabel()} Purchases</h3>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <PackageSearch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#111827] dark:text-white tracking-tight mt-1 truncate">Rs {formatNumber(data.today_purchases)}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/reports')}
            className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">{getTimeframeLabel()} Profit</h3>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight mt-1 truncate">Rs {formatNumber(data.today_profit)}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/inventory?tab=expiry')}
            className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-rose-200 dark:hover:border-rose-900 hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">Expired Medicines</h3>
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-full">
                <Skull className="h-4 w-4 text-rose-500" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-800 dark:text-rose-400 tracking-tight mt-1 truncate">{data.expired_medicines}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/reports')}
            className="p-5 border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-emerald-50">Net Profit (All Time)</h3>
              <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mt-1 truncate">Rs {formatNumber(data.net_profit)}</div>
            <p className="text-xs text-emerald-100 mt-1 font-medium opacity-80">Based on COGS</p>
          </Card>

          {/* ── Row 2 ── */}
          <Card 
            onClick={() => router.push('/dashboard/inventory?tab=current&status=Low%20Stock')}
            className="p-5 border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 rounded-2xl border border-orange-100 dark:border-orange-900/50 hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-orange-900 dark:text-orange-200">Low Stock</h3>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-orange-800 dark:text-orange-400 tracking-tight mt-1 truncate">{data.low_stock_count}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/inventory?tab=current&status=Out%20of%20Stock')}
            className="p-5 border-0 shadow-sm bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 rounded-2xl border border-rose-100 dark:border-rose-900/50 hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">Out of Stock</h3>
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-full">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-800 dark:text-rose-400 tracking-tight mt-1 truncate">{data.out_of_stock_count}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/inventory?tab=expiry')}
            className="p-5 border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/40 rounded-2xl border border-yellow-200 dark:border-yellow-900/50 hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">Expiring Soon</h3>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-800 dark:text-amber-400 tracking-tight mt-1 truncate">{data.expiring_soon_count}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/reports')}
            className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-blue-200 dark:hover:border-blue-900 hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-[#111827] dark:text-gray-200">Total Sales (All Time)</h3>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#111827] dark:text-white tracking-tight mt-1 truncate">Rs {formatNumber(data.total_sales)}</div>
          </Card>

          <Card 
            onClick={() => router.push('/dashboard/reports')}
            className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-all cursor-pointer hover:border-purple-200 dark:hover:border-purple-900 hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-bold text-[#111827] dark:text-gray-200">Total Purchases (All Time)</h3>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Download className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#111827] dark:text-white tracking-tight mt-1 truncate">Rs {formatNumber(data.total_purchases)}</div>
          </Card>
        </div>
      </div>

      <WidgetsSection timeframe={timeframe} dateRange={dateRange} refreshTrigger={refreshTrigger} />
    </div>
  );
}
