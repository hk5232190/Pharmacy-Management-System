"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import ChartsSection from "./charts-section";
import WidgetsSection from "./widgets-section";
import DashboardFilter from "./dashboard-filter";
import { toast } from "sonner";
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Global Filter State
  const [timeframe, setTimeframe] = useState("today");
  const [dateRange, setDateRange] = useState<{start: string, end: string} | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchSummary();
  }, [timeframe, dateRange]);

  const fetchSummary = async () => {
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
            onClick={() => {
              fetchSummary();
              setRefreshTrigger(prev => prev + 1);
            }} 
            variant="outline" 
            className="rounded-full shadow-sm bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-slate-900 border-border"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Dashboard
          </Button>
        </div>
      </div>

      <DashboardFilter 
        timeframe={timeframe} 
        setTimeframe={setTimeframe} 
        dateRange={dateRange} 
        setDateRange={setDateRange} 
      />

      {/* ROW 1: Filtered Business */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" /> Filtered Business
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Filtered Sales</h3>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">₹{data.today_sales.toFixed(2)}</div>
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Filtered Purchases</h3>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <PackageSearch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">₹{data.today_purchases.toFixed(2)}</div>
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Filtered Profit</h3>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{data.today_profit.toFixed(2)}</div>
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Transactions</h3>
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                <ArrowRightLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">{data.transactions_today}</div>
          </Card>
        </div>
      </div>

      {/* ROW 2: Inventory Health */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-500" /> Inventory Health
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40 rounded-2xl border border-cyan-100 dark:border-cyan-900/50">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">Current Stock Value</h3>
              <Wallet className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-cyan-700 dark:text-cyan-400 mt-2">₹{data.current_stock_value.toFixed(2)}</div>
          </Card>

          <Card className="p-5 border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 rounded-2xl border border-orange-100 dark:border-orange-900/50">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">Low Stock</h3>
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-3xl font-black text-orange-700 dark:text-orange-400 mt-2">{data.low_stock_count}</div>
          </Card>

          <Card className="p-5 border-0 shadow-sm bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 rounded-2xl border border-rose-100 dark:border-rose-900/50">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">Out of Stock</h3>
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-3xl font-black text-rose-700 dark:text-rose-400 mt-2">{data.out_of_stock_count}</div>
          </Card>

          <Card className="p-5 border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/40 rounded-2xl border border-yellow-200 dark:border-yellow-900/50">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Expiring Soon</h3>
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-700 dark:text-amber-400 mt-2">{data.expiring_soon_count}</div>
          </Card>
        </div>
      </div>

      {/* ROW 3: Business Overview */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-teal-600" /> Business Overview
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Total Medicines</h3>
              <Pill className="h-4 w-4 text-pink-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{data.total_medicines}</div>
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Total Customers</h3>
              <Users className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{data.total_customers}</div>
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Total Suppliers</h3>
              <Truck className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{data.total_suppliers}</div>
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-white dark:bg-card rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-rose-500">Expired Medicines</h3>
              <Skull className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600">{data.expired_medicines}</div>
          </Card>
        </div>
      </div>

      {/* ROW 4: Overall Financial Summary */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" /> Overall Financial Summary
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6 border border-border shadow-sm bg-white dark:bg-card rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-semibold text-muted-foreground">Total Sales (All Time)</h3>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground mt-2">₹{data.total_sales.toFixed(2)}</div>
          </Card>

          <Card className="p-6 border border-border shadow-sm bg-white dark:bg-card rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-semibold text-muted-foreground">Total Purchases (All Time)</h3>
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                <Download className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground mt-2">₹{data.total_purchases.toFixed(2)}</div>
          </Card>

          <Card className="p-6 border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-base font-medium text-emerald-50">Net Profit (All Time)</h3>
              <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-4xl font-black text-white mt-2">₹{data.net_profit.toFixed(2)}</div>
            <p className="text-xs text-emerald-100 mt-2 font-medium opacity-80">Based on Cost of Goods Sold (COGS)</p>
          </Card>
        </div>
      </div>
      
      <WidgetsSection timeframe={timeframe} dateRange={dateRange} refreshTrigger={refreshTrigger} />
      
      <ChartsSection timeframe={timeframe} dateRange={dateRange} refreshTrigger={refreshTrigger} />
    </div>
  );
}
