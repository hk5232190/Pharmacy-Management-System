"use client";

import html2canvas from "html2canvas-pro";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { 
  ShoppingCart, RefreshCw, Printer, Download, Calendar, 
  TrendingUp, PackageSearch, FileText, FileSpreadsheet,
  AlertTriangle, Activity, PackageMinus, DollarSign, Search, Check, RefreshCcw
} from "lucide-react";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

export default function ReportsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  const [activeTab, setActiveTab] = useState("sales");
  const [activeMedicineTab, setActiveMedicineTab] = useState("expiry");

  const handleRefresh = () => {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1500);
    }, 400);
  };

  return <ReportsPageInner 
    key={refreshKey} 
    refreshState={refreshState} 
    onRefresh={handleRefresh} 
    activeTab={activeTab} 
    onTabChange={setActiveTab}
    activeMedicineTab={activeMedicineTab}
    onMedicineTabChange={setActiveMedicineTab}
  />;
}

function ReportsPageInner({ 
  onRefresh, 
  refreshState, 
  activeTab, 
  onTabChange,
  activeMedicineTab,
  onMedicineTabChange
}: { 
  onRefresh: () => void, 
  refreshState: "idle" | "loading" | "done", 
  activeTab: string, 
  onTabChange: (tab: string) => void,
  activeMedicineTab: string,
  onMedicineTabChange: (tab: string) => void
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Filters
  const [timeframe, setTimeframe] = useState("last_30_days");
  const [dateRange, setDateRange] = useState<{start: string, end: string} | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // (activeTab and activeMedicineTab are now managed by wrapper)
  
  const [salesSearchTerm, setSalesSearchTerm] = useState("");
  const [salesPaymentFilter, setSalesPaymentFilter] = useState("all");
  const [salesCurrentPage, setSalesCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("");
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState("All");
  const [purchaseCurrentPage, setPurchaseCurrentPage] = useState(1);
  const [selectedPurchaseTransaction, setSelectedPurchaseTransaction] = useState<any>(null);

  const [inventorySearchTerm, setInventorySearchTerm] = useState("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("All");
  const [inventoryStockPage, setInventoryStockPage] = useState(1);
  const [inventoryMovementPage, setInventoryMovementPage] = useState(1);

  const [medicineSearchTerm, setMedicineSearchTerm] = useState("");
  const [medicineCategoryFilter, setMedicineCategoryFilter] = useState("");
  const [medicineCurrentPage, setMedicineCurrentPage] = useState(1);
  const [medicinePageSize, setMedicinePageSize] = useState(10);
  
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/categories?page_size=0').then((res: any) => {
      if (res && res.data) setCategories(res.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    // Don't fetch if custom is selected but no date range has been applied yet
    if (timeframe === 'custom' && !dateRange) return;

    if (activeTab === "sales") {
      fetchSalesReports();
    } else if (activeTab === "purchases") {
      fetchPurchaseReports();
    } else if (activeTab === "inventory") {
      fetchInventoryReports();
    } else if (activeTab === "medicine") {
      fetchMedicineReports();
    } else if (activeTab === "financial") {
      fetchFinancialReports();
    }
  }, [timeframe, dateRange, activeTab, activeMedicineTab, medicineSearchTerm, medicineCategoryFilter, medicineCurrentPage, medicinePageSize]);

  const fetchSalesReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/sales?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load sales report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/financial?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load financial report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicineReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/medicine?timeframe=${timeframe}&report_type=${activeMedicineTab}&page=${medicineCurrentPage}&page_size=${medicinePageSize}`;
      if (medicineSearchTerm) url += `&search=${encodeURIComponent(medicineSearchTerm)}`;
      if (medicineCategoryFilter && medicineCategoryFilter !== 'All') url += `&category_id=${medicineCategoryFilter}`;

      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load medicine report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/inventory?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load inventory report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/purchases?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load purchase report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = (tf: string) => {
    if (tf === 'custom') {
      setShowCustom(true);
      setTimeframe(tf);
    } else {
      setShowCustom(false);
      setDateRange(null);
      setStartDate("");
      setEndDate("");
      setTimeframe(tf);
    }
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      setDateRange({ start: startDate, end: endDate });
    }
  };

  const exportReport = async (type: 'csv' | 'excel' | 'pdf') => {
    let endpoint = activeTab === 'sales' ? '/reports/sales/export/' + type : activeTab === 'purchases' ? '/reports/purchases/export/' + type : activeTab === 'inventory' ? '/reports/inventory/export/' + type : activeTab === 'financial' ? '/reports/financial/export/' + type : '/reports/medicine/export/' + type;
    
    let url = `http://127.0.0.1:8000/api/v1${endpoint}`;
    
    let params = `?timeframe=${timeframe}`;
    if (activeTab === 'medicine') {
      params += `&report_type=${activeMedicineTab}`;
    }
    if (timeframe === 'custom' && dateRange) {
      params += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
    }
    
    if (type === 'pdf') {
      try {
        setLoading(true);
        toast.info('Generating PDF with charts... please wait.');
        let chartImageBase64 = null;
        const chartEl = document.getElementById('report-charts');
        if (chartEl) {
          const canvas = await html2canvas(chartEl, { scale: 2 });
          chartImageBase64 = canvas.toDataURL('image/png');
        }
        
        const payload = {
          timeframe: timeframe,
          start_date: dateRange?.start,
          end_date: dateRange?.end,
          chart_image: chartImageBase64,
          report_type: activeTab === 'medicine' ? activeMedicineTab : undefined
        };
        
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + params.replace('?', ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('PDF Generation failed');
        
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${activeTab}_report_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        toast.success('PDF Downloaded successfully');
      } catch (err: any) {
        toast.error(err.message || 'Error generating PDF');
      } finally {
        setLoading(false);
      }
    } else {
      window.open(url + params, '_blank');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 shadow-lg rounded-lg">
          <p className="font-semibold text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // (handleRefresh is managed by wrapper and passed as onRefresh)

  return (
    <div className="flex-1 space-y-6 p-8 print:p-0 print:space-y-0 bg-slate-50/50 print:bg-white dark:bg-background min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Analyze business performance, generate reports, and identify trends.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className={cn(
              "h-9 gap-2 transition-all duration-300 print:hidden rounded-full",
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
          <div className="flex bg-white dark:bg-card rounded-full border border-border print:hidden overflow-hidden">

            <Button variant="ghost" onClick={() => exportReport('excel')} className="rounded-none border-r border-border hover:bg-emerald-50 text-emerald-700">
              Excel
            </Button>
            <Button variant="ghost" onClick={() => exportReport('pdf')} className="rounded-none hover:bg-rose-50 text-rose-700">
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-start p-1.5 mb-6 bg-slate-100/80 dark:bg-slate-800/50 rounded-xl w-max max-w-full border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto custom-scrollbar print:hidden">
        <button
          onClick={() => { if (activeTab !== 'sales') { setData(null); onTabChange('sales'); } }}
          className={cn(
            "flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap",
            activeTab === "sales" 
              ? "bg-blue-600 dark:bg-white text-white dark:text-slate-900 shadow-md ring-1 ring-blue-700/50 dark:ring-slate-800/50" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
          )}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Sales Reports
        </button>
        <button
          onClick={() => { if (activeTab !== 'purchases') { setData(null); onTabChange('purchases'); } }}
          className={cn(
            "flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap",
            activeTab === "purchases" 
              ? "bg-blue-600 dark:bg-white text-white dark:text-slate-900 shadow-md ring-1 ring-blue-700/50 dark:ring-slate-800/50" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
          )}
        >
          <PackageSearch className="mr-2 h-4 w-4" />
          Purchase Reports
        </button>
        <button
          onClick={() => { if (activeTab !== 'inventory') { setData(null); onTabChange('inventory'); } }}
          className={cn(
            "flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap",
            activeTab === "inventory" 
              ? "bg-blue-600 dark:bg-white text-white dark:text-slate-900 shadow-md ring-1 ring-blue-700/50 dark:ring-slate-800/50" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
          )}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Inventory Reports
        </button>
        <button
          onClick={() => { if (activeTab !== 'medicine') { setData(null); onTabChange('medicine'); } }}
          className={cn(
            "flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap",
            activeTab === "medicine" 
              ? "bg-blue-600 dark:bg-white text-white dark:text-slate-900 shadow-md ring-1 ring-blue-700/50 dark:ring-slate-800/50" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
          )}
        >
          <Activity className="mr-2 h-4 w-4" />
          Medicine Reports
        </button>
        <button
          onClick={() => { if (activeTab !== 'financial') { setData(null); onTabChange('financial'); } }}
          className={cn(
            "flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ml-1",
            activeTab === "financial" 
              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shadow-md ring-1 ring-amber-200/50 dark:ring-amber-500/30" 
              : "text-amber-600 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-400"
          )}
        >
          <DollarSign className="mr-2 h-4 w-4" />
          Financial Reports
        </button>
      </div>

      {/* Filters */}
      <div 
        className={cn(
          "flex flex-col xl:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border w-full justify-between print:hidden transition-all duration-300",
          activeTab === 'medicine' && activeMedicineTab === 'low_stock' && "opacity-50 pointer-events-none grayscale"
        )}
      >
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Calendar className="w-5 h-5 text-primary" />
          Date Range
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last_7_days', label: 'Last 7 Days' },
            { id: 'last_30_days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' },
            { id: 'custom', label: 'Custom Range' }
          ].map((f) => (
            <Button
              key={f.id}
              variant={timeframe === f.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleTimeframeChange(f.id)}
              className="rounded-full"
            >
              {f.label}
            </Button>
          ))}
          {showCustom && (
            <div className="flex items-center gap-2 ml-4 animate-in fade-in duration-200">
              <input 
                type="date" 
                className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-muted-foreground">to</span>
              <input 
                type="date" 
                className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Button 
                size="sm" 
                onClick={handleApplyCustom}
                disabled={!startDate || !endDate}
                className="bg-primary text-primary-foreground"
              >
                Apply
              </Button>
              {dateRange && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  ✓ Applied
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && !data && (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {data && activeTab === 'sales' && (() => {
        const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
          blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
          rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
          emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          purple:  { border: "border-l-purple-500",  iconCls: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
          teal:    { border: "border-l-teal-500",    iconCls: "text-teal-500",    text: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-50 dark:bg-teal-900/20" },
          amber:   { border: "border-l-amber-500",   iconCls: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
          indigo:  { border: "border-l-indigo-500",  iconCls: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-900/20" },
        };

        const KPICard = ({ title, value, icon: Icon, accent, subtext, badge }: { title: string; value: string; icon: any; accent: string; subtext?: React.ReactNode; badge?: React.ReactNode }) => {
          const a = accentMap[accent] ?? accentMap.blue;
          return (
            <div className={`relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md ${a.border}`}>
              <div className="flex justify-between items-start">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
                  <Icon className={`w-5 h-5 ${a.iconCls}`} />
                </div>
                {badge && (
                  <div className={`px-2 py-1 rounded-md text-xs font-semibold bg-white/80 dark:bg-black/20 ${a.text}`}>
                    {badge}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
                <p className={`text-2xl font-extrabold leading-none tabular-nums truncate ${a.text}`}>{value}</p>
                {subtext && (
                  <p className="text-xs text-muted-foreground mt-1.5 font-medium">{subtext}</p>
                )}
              </div>
            </div>
          );
        };

        return (
          <>
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">

            {/* Row 1: 5 Primary KPIs */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <KPICard 
                title="Net Sales" 
                value={`Rs ${data?.summary?.NetSales?.toLocaleString() || '0'}`} 
                icon={TrendingUp}   
                accent="emerald"
                subtext={`Gross: Rs ${data?.summary?.TotalGrossSales?.toLocaleString() || '0'} | Returns: Rs ${data?.summary?.TotalReturns?.toLocaleString() || '0'}`}
              />
              <KPICard 
                title="Net Profit" 
                value={`Rs ${data?.summary?.NetProfit?.toLocaleString() || '0'}`} 
                icon={DollarSign}   
                accent="teal"
                badge={`${data?.summary?.ProfitMarginPercent?.toFixed(1) || '0.0'}% Margin`}
              />
              <KPICard 
                title="COGS"           
                value={`Rs ${data?.summary?.TotalCOGS?.toLocaleString() || '0'}`}                               
                icon={ShoppingCart} 
                accent="purple" 
                subtext="Cost of Goods Sold"
              />
              <KPICard 
                title="Invoices & Avg"  
                value={data?.summary?.TotalInvoices?.toLocaleString() || '0'}                                   
                icon={FileText}     
                accent="indigo" 
                subtext={`Avg Sale: Rs ${data?.summary?.AverageSale?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`}
              />
              <KPICard 
                title="Highest Sale"   
                value={`Rs ${data?.summary?.HighestSale?.toLocaleString() || '0'}`}                             
                icon={TrendingUp}   
                accent="amber" 
              />
            </div>

            {/* Row 2: Charts */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-4 border border-border shadow-sm rounded-xl flex flex-col">
                <h3 className="font-semibold mb-4 text-foreground">Sales vs Profit Trend</h3>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.trend_data || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} tickFormatter={(val) => {
                        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
                          const d = new Date(val);
                          if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        }
                        return val;
                      }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val/1000}k`} dx={-10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Area yAxisId="left" type="monotone" name="Sales" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Area yAxisId="left" type="monotone" name="Profit" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" activeDot={{ r: 6, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl flex flex-col">
                <h3 className="font-semibold mb-4 text-foreground">Sales by Payment Method</h3>
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px]">
                  <div className="h-32 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data?.payment_methods || []} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                          {data?.payment_methods?.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full">
                    <ul className="flex flex-col gap-2.5 text-sm w-full">
                      {(() => {
                        const totalPayment = data?.payment_methods?.reduce((acc: number, curr: any) => acc + curr.value, 0) || 0;
                        return data?.payment_methods?.map((entry: any, index: number) => {
                          const percent = totalPayment > 0 ? Math.round((entry.value / totalPayment) * 100) : 0;
                          return (
                            <li key={index} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-muted-foreground font-medium">{entry.name || `Method ${index + 1}`}</span>
                              </div>
                              <span className="font-semibold text-foreground">
                                Rs {entry.value.toLocaleString()} <span className="text-xs text-muted-foreground font-normal ml-1">({percent}%)</span>
                              </span>
                            </li>
                          );
                        });
                      })()}
                    </ul>
                  </div>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl flex flex-col">
                <h3 className="font-semibold mb-4 text-foreground truncate" title="Top 5 Best Selling Medicines">Top 5 Best Selling</h3>
                <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.top_medicines || []} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} interval={0} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val/1000}k`} dx={-5} />
                      <Tooltip cursor={{fill: 'rgba(100,116,139,0.1)'}} content={<CustomTooltip />} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} name="Revenue">
                        {data?.top_medicines?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>

            {/* Row 3: Sales Summary Table */}
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-semibold text-lg">Sales Summary</h3>
                <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Search invoice/customer" 
                      value={salesSearchTerm}
                      onChange={(e) => { setSalesSearchTerm(e.target.value); setSalesCurrentPage(1); }}
                      className="pl-9 h-9 bg-white dark:bg-background border-border"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium hidden sm:inline-block">Payment Type:</span>
                    <select 
                      className="h-9 rounded-md border border-border bg-white dark:bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                      value={salesPaymentFilter}
                      onChange={(e) => { setSalesPaymentFilter(e.target.value); setSalesCurrentPage(1); }}
                    >
                      <option value="all">All Payments</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto relative">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-medium w-12">#</th>
                      <th className="px-4 py-3 font-medium">Invoice No.</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium text-right">Items</th>
                      <th className="px-4 py-3 font-medium text-right">Qty</th>
                      <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                      <th className="px-4 py-3 font-medium text-right">Profit</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const filteredSalesTransactions = data?.transactions?.filter((t: any) => 
                        ((t.InvoiceNo && t.InvoiceNo.toLowerCase().includes(salesSearchTerm.toLowerCase())) ||
                        (t.CustomerName && t.CustomerName.toLowerCase().includes(salesSearchTerm.toLowerCase()))) &&
                        (salesPaymentFilter === 'all' || (t.PaymentMethod && t.PaymentMethod.toLowerCase() === salesPaymentFilter))
                      ) || [];

                      const totalGrandTotal = filteredSalesTransactions.reduce((acc: number, t: any) => acc + (t.GrandTotal || 0), 0);
                      const totalProfit = filteredSalesTransactions.reduce((acc: number, t: any) => acc + (t.Profit || 0), 0);

                      const startIndex = (salesCurrentPage - 1) * 10;
                      const paginatedTransactions = filteredSalesTransactions.slice(startIndex, startIndex + 10);

                      return (
                        <>
                          {paginatedTransactions.length > 0 ? (
                            paginatedTransactions.map((t: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedInvoice(t)}>
                                <td className="px-4 py-3 text-muted-foreground">{startIndex + idx + 1}</td>
                                <td className="px-4 py-3 font-medium text-blue-600">{t.InvoiceNo}</td>
                                <td className="px-4 py-3">{new Date(t.TransactionDate).toLocaleString()}</td>
                                <td className="px-4 py-3">{t.CustomerName}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{t.MedicinesSold}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{t.TotalQty}</td>
                                <td className="px-4 py-3 text-right font-medium tabular-nums">Rs {t.GrandTotal.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">Rs {t.Profit ? t.Profit.toLocaleString() : '0'}</td>
                                <td className="px-4 py-3">{t.PaymentMethod}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.Status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {t.Status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                                No transactions found for the selected filters.
                              </td>
                            </tr>
                          )}
                          {/* Sticky Footer */}
                          {filteredSalesTransactions.length > 0 && (
                            <tr className="bg-slate-50 dark:bg-slate-900/90 border-t-2 border-border font-semibold sticky bottom-0">
                              <td colSpan={6} className="px-4 py-3 text-right">Totals (Filtered):</td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">Rs {totalGrandTotal.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600">Rs {totalProfit.toLocaleString()}</td>
                              <td colSpan={2}></td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {(() => {
                const filteredLength = data?.transactions?.filter((t: any) => 
                  ((t.InvoiceNo && t.InvoiceNo.toLowerCase().includes(salesSearchTerm.toLowerCase())) ||
                  (t.CustomerName && t.CustomerName.toLowerCase().includes(salesSearchTerm.toLowerCase()))) &&
                  (salesPaymentFilter === 'all' || (t.PaymentMethod && t.PaymentMethod.toLowerCase() === salesPaymentFilter))
                ).length || 0;
                
                const totalPages = Math.ceil(filteredLength / 10);
                if (filteredLength === 0) return null;

                const startIdx = (salesCurrentPage - 1) * 10 + 1;
                const endIdx = Math.min(salesCurrentPage * 10, filteredLength);

                return (
                  <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-white dark:bg-card">
                    <div>
                      Showing <span className="font-medium text-foreground">{startIdx}</span> - <span className="font-medium text-foreground">{endIdx}</span> of <span className="font-medium text-foreground">{filteredLength}</span> invoices
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={salesCurrentPage === 1}
                        onClick={() => setSalesCurrentPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={salesCurrentPage === totalPages}
                        onClick={() => setSalesCurrentPage(p => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>

          </div>

          {/* -------------------- PRINT TEMPLATE -------------------- */}
          <div className="hidden print:block w-full bg-white text-black font-sans">
            <style type="text/css" media="print">
              {`
                @page { size: A4; margin: 12mm; }
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
              `}
            </style>

            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-200 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CarePlus Pharmacy</h1>
                <p className="text-sm text-gray-500 mt-1">Main Branch | Contact: 0300-XXXXXXX</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Sales Performance Report</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Period: {timeframe === 'custom' && dateRange ? `${new Date(dateRange.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(dateRange.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : timeframe.replace(/_/g, ' ').toUpperCase()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Generated: {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Sales</p>
                <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">Rs. {data?.summary?.TotalGrossSales?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Returns</p>
                <p className="text-lg font-bold text-rose-600 mt-1 tabular-nums">Rs. {data?.summary?.TotalReturns?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-emerald-50">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Net Sales</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-1 tabular-nums">Rs. {data?.summary?.NetSales?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Invoices</p>
                <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{data?.summary?.TotalInvoices?.toLocaleString() || '0'}</p>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase text-[11px] tracking-wider border border-slate-800">Invoice No</th>
                  <th className="px-3 py-2 font-semibold uppercase text-[11px] tracking-wider border border-slate-800">Date & Time</th>
                  <th className="px-3 py-2 font-semibold uppercase text-[11px] tracking-wider border border-slate-800">Customer</th>
                  <th className="px-3 py-2 font-semibold uppercase text-[11px] tracking-wider border border-slate-800 text-right">Items</th>
                  <th className="px-3 py-2 font-semibold uppercase text-[11px] tracking-wider border border-slate-800 text-right">Total Qty</th>
                  <th className="px-3 py-2 font-semibold uppercase text-[11px] tracking-wider border border-slate-800 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const printData = data?.transactions || [];
                  const totalQty = printData.reduce((acc: number, t: any) => acc + (t.TotalQty || 0), 0);
                  const totalItems = printData.reduce((acc: number, t: any) => acc + (t.MedicinesSold || 0), 0);
                  const totalGrand = printData.reduce((acc: number, t: any) => acc + (t.GrandTotal || 0), 0);

                  return (
                    <>
                      {printData.map((t: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-200 even:bg-gray-50">
                          <td className="px-3 py-2 font-mono font-bold text-gray-800">{t.InvoiceNo}</td>
                          <td className="px-3 py-2 text-gray-600">{new Date(t.TransactionDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                          <td className="px-3 py-2 text-gray-800">{t.CustomerName || '-'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{t.MedicinesSold}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{t.TotalQty}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{t.GrandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-800 bg-gray-100">
                        <td colSpan={3} className="px-3 py-3 text-right font-bold text-gray-900 uppercase text-xs">Total for Period:</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums">{totalItems}</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums">{totalQty}</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums text-base">Rs. {totalGrand.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 w-full text-center text-xs text-gray-400 py-4 border-t border-gray-200 mt-8">
              CarePlus Pharmacy System • Page 1 of 1
            </div>
          </div>
          </>
        );
      })()}


      {data && activeTab === 'inventory' && (() => {
        const KPICard = ({ title, value, icon: Icon, accent }: { title: string; value: string; icon: any; accent: string }) => {
          const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
            blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
            emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
            purple:  { border: "border-l-purple-500",  iconCls: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
            amber:   { border: "border-l-amber-500",   iconCls: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
          };
          const a = accentMap[accent] ?? accentMap.blue;
          return (
            <div className={`relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md ${a.border}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
                <Icon className={`w-5 h-5 ${a.iconCls}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
                <p className={`text-2xl font-extrabold leading-none tabular-nums truncate ${a.text}`}>{value}</p>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Summary KPIs */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <KPICard title="Total Cost Value"       value={`Rs ${data?.summary?.TotalCostValue?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`}           icon={DollarSign}   accent="blue" />
              <KPICard title="Potential Retail Value" value={`Rs ${data?.summary?.TotalRetailValue?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`}         icon={TrendingUp}   accent="emerald" />
              <KPICard title="Expired"                value={`Rs ${data?.summary?.ExpiredWrittenOffValuation?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`} icon={TrendingUp}   accent="rose" />
              <KPICard title="Total Items in Stock"   value={data?.summary?.TotalItemsInStock?.toLocaleString() || '0'}                                                     icon={FileText}     accent="purple" />
              <KPICard title="Low Stock"              value={data?.summary?.LowStockCount?.toLocaleString() || '0'}                                                         icon={AlertTriangle} accent="amber" />
              <KPICard title="Out of Stock"           value={data?.summary?.OutOfStockCount?.toLocaleString() || '0'}                                                       icon={PackageMinus}  accent="rose" />
            </div>


          {/* Row 2: Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            
            <Card className="p-4 border border-border shadow-sm rounded-xl">
              <h3 className="font-semibold mb-4">Valuation by Category</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.category_valuation || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data?.category_valuation?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {data.movement_summary && (
              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Movement Summary</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={[
                        { name: 'Purchased', value: data.movement_summary.PurchasedQty },
                        { name: 'Sold', value: data.movement_summary.SoldQty },
                        { name: 'Adjusted', value: data.movement_summary.ManualAdjustmentsQty },
                        { name: 'Expired', value: data.movement_summary.ExpiredWrittenOffQty }
                      ]} 
                      margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dx={-5} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                      <Tooltip cursor={{fill: 'rgba(100,116,139,0.1)'}} content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Quantity" radius={[4, 4, 0, 0]} barSize={32}>
                        {
                          [
                            { name: 'Purchased', value: data.movement_summary.PurchasedQty },
                            { name: 'Sold', value: data.movement_summary.SoldQty },
                            { name: 'Adjusted', value: data.movement_summary.ManualAdjustmentsQty },
                            { name: 'Expired', value: data.movement_summary.ExpiredWrittenOffQty }
                          ].map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={
                              entry.name === 'Purchased' ? '#10b981' : 
                              entry.name === 'Sold' ? '#3b82f6' : 
                              entry.name === 'Adjusted' ? '#8b5cf6' : 
                              '#f43f5e'
                            } />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

          </div>

          {/* Row 3: Data Tables */}
          <div className="space-y-6">
            
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-semibold text-lg">Current Stock Valuation</h3>
                <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Search medicine, batch..." 
                      value={inventorySearchTerm}
                      onChange={(e) => { setInventorySearchTerm(e.target.value); setInventoryStockPage(1); }}
                      className="pl-9 h-9 bg-white dark:bg-background border-border"
                    />
                  </div>
                  <select 
                    className="h-9 rounded-full border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={inventoryCategoryFilter}
                    onChange={(e) => { setInventoryCategoryFilter(e.target.value); setInventoryStockPage(1); }}
                  >
                    <option value="All">All Categories</option>
                    {Array.from(new Set(data?.stock_items?.map((item: any) => item.Category).filter(Boolean))).map((cat: any) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium text-left w-12">#</th>
                      <th className="px-4 py-3 font-medium text-left">Medicine</th>
                      <th className="px-4 py-3 font-medium text-left">Category</th>
                      <th className="px-4 py-3 font-medium text-left">Batch</th>
                      <th className="px-4 py-3 font-medium text-right">Qty</th>
                      <th className="px-4 py-3 font-medium text-right">Cost</th>
                      <th className="px-4 py-3 font-medium text-right">Retail</th>
                      <th className="px-4 py-3 font-medium text-right">Total Cost</th>
                      <th className="px-4 py-3 font-medium text-right">Total Retail</th>
                      <th className="px-4 py-3 font-medium text-right">Potential Margin (Rs.)</th>
                      <th className="px-4 py-3 font-medium text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const filteredStock = data?.stock_items?.filter((t: any) => {
                        const matchesSearch = !inventorySearchTerm || 
                          t.MedicineName?.toLowerCase().includes(inventorySearchTerm.toLowerCase()) || 
                          t.BatchCode?.toLowerCase().includes(inventorySearchTerm.toLowerCase());
                        const matchesCategory = inventoryCategoryFilter === 'All' || t.Category === inventoryCategoryFilter;
                        return matchesSearch && matchesCategory;
                      }) || [];

                      let sumQty = 0;
                      let sumCost = 0;
                      let sumRetail = 0;
                      let sumMargin = 0;

                      filteredStock.forEach((t: any) => {
                        const margin = (t.TotalRetailValue || 0) - (t.TotalCostValue || 0);
                        sumQty += t.Quantity || 0;
                        sumCost += t.TotalCostValue || 0;
                        sumRetail += t.TotalRetailValue || 0;
                        sumMargin += margin;
                      });

                      const startIndex = (inventoryStockPage - 1) * 10;
                      const paginatedStock = filteredStock.slice(startIndex, startIndex + 10);

                      const rows = paginatedStock.map((t: any, idx: number) => {
                        const margin = (t.TotalRetailValue || 0) - (t.TotalCostValue || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 text-muted-foreground">{startIndex + idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-foreground text-left">{t.MedicineName}</td>
                            <td className="px-4 py-3 text-muted-foreground text-left">{t.Category}</td>
                            <td className="px-4 py-3 text-left">{t.BatchCode}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{t.Quantity}</td>
                            <td className="px-4 py-3 text-right tabular-nums">Rs {t.CostPrice}</td>
                            <td className="px-4 py-3 text-right tabular-nums">Rs {t.SellingPrice}</td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums">Rs {t.TotalCostValue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-600">Rs {t.TotalRetailValue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums text-blue-600">Rs {margin.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-left">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                t.Status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                              }`}>
                                {t.Status}
                              </span>
                            </td>
                          </tr>
                        );
                      });

                      return (
                        <>
                          {rows.length > 0 ? rows : (
                            <tr>
                              <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                                No stock items found matching your filters.
                              </td>
                            </tr>
                          )}
                          {filteredStock.length > 0 && (
                            <tr className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                              <td colSpan={4} className="px-4 py-3 text-right font-bold text-foreground uppercase text-xs tracking-wider">Filtered Totals:</td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">{sumQty}</td>
                              <td colSpan={2}></td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">Rs {sumCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">Rs {sumRetail.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-600">Rs {sumMargin.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td></td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              {(() => {
                const filteredLength = data?.stock_items?.filter((t: any) => {
                  const matchesSearch = !inventorySearchTerm || 
                    t.MedicineName?.toLowerCase().includes(inventorySearchTerm.toLowerCase()) || 
                    t.BatchCode?.toLowerCase().includes(inventorySearchTerm.toLowerCase());
                  const matchesCategory = inventoryCategoryFilter === 'All' || t.Category === inventoryCategoryFilter;
                  return matchesSearch && matchesCategory;
                }).length || 0;
                
                if (filteredLength === 0) return null;
                const totalPages = Math.ceil(filteredLength / 10);
                const startIdx = (inventoryStockPage - 1) * 10 + 1;
                const endIdx = Math.min(inventoryStockPage * 10, filteredLength);

                return (
                  <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-white dark:bg-card">
                    <div>
                      Showing <span className="font-medium text-foreground">{startIdx}</span> - <span className="font-medium text-foreground">{endIdx}</span> of <span className="font-medium text-foreground">{filteredLength}</span> items
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={inventoryStockPage === 1}
                        onClick={() => setInventoryStockPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={inventoryStockPage >= totalPages}
                        onClick={() => setInventoryStockPage(p => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>

            {data.movement_items && (
              <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Stock Movement Details (Period)</h3>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-medium w-12">#</th>
                        <th className="px-4 py-3 font-medium">Medicine</th>
                        <th className="px-4 py-3 font-medium text-right">Start Stock</th>
                        <th className="px-4 py-3 font-medium text-right text-emerald-600">Purchased</th>
                        <th className="px-4 py-3 font-medium text-right text-blue-600">Sold</th>
                        <th className="px-4 py-3 font-medium text-right text-purple-600">Adjusted</th>
                        <th className="px-4 py-3 font-medium text-right text-rose-600">Expired</th>
                        <th className="px-4 py-3 font-medium text-right">Close Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(() => {
                        let sumStart = 0;
                        let sumPurchased = 0;
                        let sumSold = 0;
                        let sumAdjusted = 0;
                        let sumExpired = 0;
                        let sumClose = 0;

                        data.movement_items.forEach((t: any) => {
                          const calculatedCloseStock = (t.StartingStock || 0) + (t.PurchasedQty || 0) - (t.SoldQty || 0) + (t.AdjustedQty || 0) - (t.ExpiredQty || 0);
                          
                          sumStart += (t.StartingStock || 0);
                          sumPurchased += (t.PurchasedQty || 0);
                          sumSold += (t.SoldQty || 0);
                          sumAdjusted += (t.AdjustedQty || 0);
                          sumExpired += (t.ExpiredQty || 0);
                          sumClose += calculatedCloseStock;
                        });

                        const startIndex = (inventoryMovementPage - 1) * 10;
                        const paginatedMovement = data.movement_items.slice(startIndex, startIndex + 10);

                        const rows = paginatedMovement.map((t: any, idx: number) => {
                          const calculatedCloseStock = (t.StartingStock || 0) + (t.PurchasedQty || 0) - (t.SoldQty || 0) + (t.AdjustedQty || 0) - (t.ExpiredQty || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 text-muted-foreground">{startIndex + idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-foreground text-left">{t.MedicineName}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{t.StartingStock || 0}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600">+{t.PurchasedQty || 0}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-blue-600">-{t.SoldQty || 0}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-purple-600">{(t.AdjustedQty || 0) > 0 ? `+${t.AdjustedQty}` : (t.AdjustedQty || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-rose-600">-{t.ExpiredQty || 0}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">{calculatedCloseStock}</td>
                            </tr>
                          );
                        });

                        return (
                          <>
                            {rows.length > 0 ? rows : (
                              <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                  No movement found for the selected period.
                                </td>
                              </tr>
                            )}
                            {data.movement_items.length > 0 && (
                              <tr className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                                <td colSpan={2} className="px-4 py-3 text-right font-bold text-foreground uppercase text-xs tracking-wider">Totals:</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-muted-foreground">{sumStart}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">+{sumPurchased}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-600">-{sumSold}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-purple-600">{(sumAdjusted > 0 ? `+${sumAdjusted}` : sumAdjusted)}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-600">-{sumExpired}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">{sumClose}</td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const filteredLength = data?.movement_items?.length || 0;
                  if (filteredLength === 0) return null;
                  
                  const totalPages = Math.ceil(filteredLength / 10);
                  const startIdx = (inventoryMovementPage - 1) * 10 + 1;
                  const endIdx = Math.min(inventoryMovementPage * 10, filteredLength);

                  return (
                    <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-white dark:bg-card">
                      <div>
                        Showing <span className="font-medium text-foreground">{startIdx}</span> - <span className="font-medium text-foreground">{endIdx}</span> of <span className="font-medium text-foreground">{filteredLength}</span> items
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={inventoryMovementPage === 1}
                          onClick={() => setInventoryMovementPage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={inventoryMovementPage >= totalPages}
                          onClick={() => setInventoryMovementPage(p => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            )}

          </div>
        </div>
        );
      })()}


      {data && activeTab === 'purchases' && (() => {
        const KPICard = ({ title, value, icon: Icon, accent, subtext }: { title: string; value: string | number | React.ReactNode; icon: any; accent: string; subtext?: React.ReactNode }) => {
          const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
            blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
            emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
            purple:  { border: "border-l-purple-500",  iconCls: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
            amber:   { border: "border-l-amber-500",   iconCls: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
            indigo:  { border: "border-l-indigo-500",  iconCls: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          };
          const a = accentMap[accent] ?? accentMap.blue;
          return (
            <div className={`relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md ${a.border}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
                <Icon className={`w-5 h-5 ${a.iconCls}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
                <div className={`text-2xl font-extrabold leading-none tabular-nums truncate ${a.text}`}>{value}</div>
                {subtext && <p className="text-xs text-muted-foreground mt-1.5 font-medium truncate">{subtext}</p>}
              </div>
            </div>
          );
        };

        const totalSupplierDue = data?.transactions?.reduce((acc: number, t: any) => 
          (t.Status === 'Pending' || t.Status === 'Unpaid' || t.Status === 'Credit') ? acc + t.GrandTotal : acc, 0
        ) || 0;

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Summary KPIs: 1 Row */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <KPICard 
                title="Net Purchases"   
                value={`Rs ${data?.summary?.NetPurchases?.toLocaleString() || '0'}`}                                
                icon={ShoppingCart} 
                accent="emerald" 
                subtext={`Gross: Rs ${data?.summary?.TotalGrossPurchases?.toLocaleString() || '0'} | Returns: Rs ${data?.summary?.TotalReturns?.toLocaleString() || '0'}`}
              />
              <KPICard 
                title="Returns"         
                value={`Rs ${data?.summary?.TotalReturns?.toLocaleString() || '0'}`}                                
                icon={TrendingUp}   
                accent="rose" 
              />
              <KPICard 
                title="Supplier Due / Payables"  
                value={`Rs ${totalSupplierDue.toLocaleString()}`}
                icon={DollarSign}     
                accent="blue" 
                subtext="Total unpaid balance"
              />
              <KPICard 
                title="Invoices & Avg"  
                value={data?.summary?.TotalInvoices?.toLocaleString() || '0'}                                       
                icon={FileText}     
                accent="indigo" 
                subtext={`Avg Purchase: Rs ${data?.summary?.AveragePurchase?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`}
              />
              <KPICard 
                title="Highest Purchase" 
                value={`Rs ${data?.summary?.HighestPurchase?.toLocaleString() || '0'}`}                             
                icon={TrendingUp}   
                accent="amber" 
              />
            </div>

            {/* Row 2: Charts (3 side by side) */}
            <div className="grid gap-6 lg:grid-cols-3">
              
              <Card className="p-4 border border-border shadow-sm rounded-xl flex flex-col">
                <h3 className="font-semibold mb-4 text-foreground">Purchase Trend</h3>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.trend_data || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} tickFormatter={(val) => {
                        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
                          const d = new Date(val);
                          if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        }
                        return val;
                      }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val/1000}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" name="Purchases" dataKey="purchases" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl flex flex-col">
                <h3 className="font-semibold mb-4 text-foreground">Purchases by Supplier</h3>
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px]">
                  <div className="h-32 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.suppliers || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {data?.suppliers?.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full">
                    <ul className="flex flex-col gap-2.5 text-sm w-full">
                      {(() => {
                        const totalSupplier = data?.suppliers?.reduce((acc: number, curr: any) => acc + curr.value, 0) || 0;
                        return data?.suppliers?.map((entry: any, index: number) => {
                          const percent = totalSupplier > 0 ? Math.round((entry.value / totalSupplier) * 100) : 0;
                          return (
                            <li key={index} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-muted-foreground font-medium truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                              </div>
                              <span className="font-semibold text-foreground whitespace-nowrap">
                                Rs {entry.value.toLocaleString()} <span className="text-xs text-muted-foreground font-normal ml-1">({percent}%)</span>
                              </span>
                            </li>
                          );
                        });
                      })()}
                    </ul>
                  </div>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl flex flex-col">
                <h3 className="font-semibold mb-4 text-foreground truncate" title="Top 5 Purchased Medicines">Top 5 Purchased Medicines</h3>
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.top_medicines || []} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} interval={0} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val/1000}k`} dx={-5} />
                      <Tooltip cursor={{fill: 'rgba(100,116,139,0.1)'}} content={<CustomTooltip />} />
                      <Bar dataKey="cost" name="Cost" radius={[4, 4, 0, 0]} barSize={32}>
                        {data?.top_medicines?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>

            {/* Row 3: Data Table */}
            <div className="space-y-6">
              
              <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="font-semibold text-lg">Purchase Summary</h3>
                  <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        placeholder="Search invoice no. or supplier..." 
                        value={purchaseSearchTerm}
                        onChange={(e) => { setPurchaseSearchTerm(e.target.value); setPurchaseCurrentPage(1); }}
                        className="pl-9 h-9 bg-white dark:bg-background border-border"
                      />
                    </div>
                    <select 
                      className="h-9 rounded-full border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={purchasePaymentFilter}
                      onChange={(e) => { setPurchasePaymentFilter(e.target.value); setPurchaseCurrentPage(1); }}
                    >
                      <option value="All">All Status</option>
                      <option value="Paid">Paid / Completed</option>
                      <option value="Partial">Partial</option>
                      <option value="Unpaid">Unpaid / Pending</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left relative">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-medium text-left w-12">#</th>
                        <th className="px-4 py-3 font-medium">Invoice No.</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Supplier</th>
                        <th className="px-4 py-3 font-medium text-right">Items</th>
                        <th className="px-4 py-3 font-medium text-right">Qty</th>
                        <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                        <th className="px-4 py-3 font-medium text-right">Paid</th>
                        <th className="px-4 py-3 font-medium text-right">Balance Due</th>
                        <th className="px-4 py-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(() => {
                        const filteredPurchases = data?.transactions?.filter((t: any) => {
                          const matchesSearch = !purchaseSearchTerm || t.InvoiceNo.toLowerCase().includes(purchaseSearchTerm.toLowerCase()) || 
                                                (t.SupplierName || '').toLowerCase().includes(purchaseSearchTerm.toLowerCase());
                          let matchesStatus = true;
                          if (purchasePaymentFilter === 'Paid') {
                            matchesStatus = t.Status === 'Completed' || t.Status === 'Paid';
                          } else if (purchasePaymentFilter === 'Unpaid') {
                            matchesStatus = t.Status === 'Pending' || t.Status === 'Unpaid' || t.Status === 'Credit';
                          } else if (purchasePaymentFilter === 'Partial') {
                            matchesStatus = t.Status === 'Partial';
                          }
                          return matchesSearch && matchesStatus;
                        }) || [];

                        const totalItems = filteredPurchases.reduce((acc: number, t: any) => acc + (t.MedicinesPurchased || 0), 0);
                        const totalQty = filteredPurchases.reduce((acc: number, t: any) => acc + (t.TotalQty || 0), 0);
                        const totalGrand = filteredPurchases.reduce((acc: number, t: any) => acc + (t.GrandTotal || 0), 0);
                        let totalBalance = 0;
                        let totalPaid = 0;

                        filteredPurchases.forEach((t: any) => {
                          const isPaid = t.Status === 'Completed' || t.Status === 'Paid';
                          const paid = isPaid ? t.GrandTotal : (t.PaidAmount || 0);
                          const balance = t.GrandTotal - paid;
                          totalBalance += balance;
                          totalPaid += paid;
                        });

                        const startIndex = (purchaseCurrentPage - 1) * 10;
                        const paginatedPurchases = filteredPurchases.slice(startIndex, startIndex + 10);

                        const rows = paginatedPurchases.map((t: any, idx: number) => {
                          const isPaid = t.Status === 'Completed' || t.Status === 'Paid';
                          const paid = isPaid ? t.GrandTotal : (t.PaidAmount || 0);
                          const balance = t.GrandTotal - paid;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 cursor-pointer transition-colors" onClick={() => setSelectedPurchaseTransaction(t)}>
                              <td className="px-4 py-3 text-muted-foreground">{startIndex + idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-blue-600">{t.InvoiceNo}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{new Date(t.PurchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                              <td className="px-4 py-3 font-medium">{t.SupplierName}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{t.MedicinesPurchased}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{t.TotalQty}</td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">Rs {t.GrandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600">Rs {paid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-rose-600">Rs {balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                }`}>
                                  {t.Status}
                                </span>
                              </td>
                            </tr>
                          );
                        });

                        return (
                          <>
                            {rows.length > 0 ? rows : (
                              <tr>
                                <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                                  No transactions found matching your filters.
                                </td>
                              </tr>
                            )}
                            {rows.length > 0 && (
                              <tr className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                                <td colSpan={4} className="px-4 py-3 text-right font-bold text-foreground uppercase text-xs tracking-wider">Filtered Totals:</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">{totalItems}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">{totalQty}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">Rs {totalGrand.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">Rs {totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-600">Rs {totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td></td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const filteredLength = data?.transactions?.filter((t: any) => {
                    const matchesSearch = !purchaseSearchTerm || t.InvoiceNo.toLowerCase().includes(purchaseSearchTerm.toLowerCase()) || 
                                          (t.SupplierName || '').toLowerCase().includes(purchaseSearchTerm.toLowerCase());
                    let matchesStatus = true;
                    if (purchasePaymentFilter === 'Paid') {
                      matchesStatus = t.Status === 'Completed' || t.Status === 'Paid';
                    } else if (purchasePaymentFilter === 'Unpaid') {
                      matchesStatus = t.Status === 'Pending' || t.Status === 'Unpaid' || t.Status === 'Credit';
                    } else if (purchasePaymentFilter === 'Partial') {
                      matchesStatus = t.Status === 'Partial';
                    }
                    return matchesSearch && matchesStatus;
                  }).length || 0;
                  
                  if (filteredLength === 0) return null;
                  const totalPages = Math.ceil(filteredLength / 10);
                  const startIdx = (purchaseCurrentPage - 1) * 10 + 1;
                  const endIdx = Math.min(purchaseCurrentPage * 10, filteredLength);

                  return (
                    <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-white dark:bg-card">
                      <div>
                        Showing <span className="font-medium text-foreground">{startIdx}</span> - <span className="font-medium text-foreground">{endIdx}</span> of <span className="font-medium text-foreground">{filteredLength}</span> invoices
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={purchaseCurrentPage === 1}
                          onClick={() => setPurchaseCurrentPage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={purchaseCurrentPage >= totalPages}
                          onClick={() => setPurchaseCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </Card>

              {/* Purchase Details Modal */}
              <Dialog open={!!selectedPurchaseTransaction} onOpenChange={(open) => !open && setSelectedPurchaseTransaction(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Purchase Invoice: <span className="text-primary">{selectedPurchaseTransaction?.InvoiceNo}</span></DialogTitle>
                    <DialogDescription>
                      Supplier: <span className="font-medium text-foreground">{selectedPurchaseTransaction?.SupplierName}</span> | Date: {selectedPurchaseTransaction ? new Date(selectedPurchaseTransaction.PurchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border border-border">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Status</p>
                        <p className="font-semibold">{selectedPurchaseTransaction?.Status}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Items / Qty</p>
                        <p className="font-semibold">{selectedPurchaseTransaction?.MedicinesPurchased} / {selectedPurchaseTransaction?.TotalQty}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Discount / Tax</p>
                        <p className="font-semibold">Rs {selectedPurchaseTransaction?.Discount || 0} / Rs {selectedPurchaseTransaction?.Tax || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Grand Total</p>
                        <p className="font-semibold text-primary">Rs {selectedPurchaseTransaction?.GrandTotal?.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>
                    
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <PackageSearch className="w-4 h-4 text-primary" /> Item Breakdown
                    </h4>
                    <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-medium">Detailed Batch View</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-12 text-center text-muted-foreground bg-slate-50/30">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <PackageSearch className="w-8 h-8 text-slate-300" />
                                <p>Detailed batch breakdown is not included in the summary report.</p>
                                <span className="text-xs">Please check the individual Purchase module for full invoice details.</span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

          </div>
        );
      })()}

      {data && activeTab === 'medicine' && (() => {
        const KPICard = ({ title, value, icon: Icon, accent }: { title: string; value: string | number; icon: any; accent: string }) => {
          const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
            blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
            emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
            purple:  { border: "border-l-purple-500",  iconCls: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
            amber:   { border: "border-l-amber-500",   iconCls: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
            indigo:  { border: "border-l-indigo-500",  iconCls: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-900/20" },
            orange:  { border: "border-l-orange-500",  iconCls: "text-orange-500",  text: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-900/20" },
            slate:   { border: "border-l-slate-500",   iconCls: "text-slate-500",   text: "text-slate-700 dark:text-slate-300",     bg: "bg-slate-100 dark:bg-slate-800" },
          };
          const a = accentMap[accent] ?? accentMap.blue;
          return (
            <div className={`relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md ${a.border}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
                <Icon className={`w-5 h-5 ${a.iconCls}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
                <div className={`text-2xl font-extrabold leading-none tabular-nums truncate ${a.text}`}>{value}</div>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Summary KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <KPICard title="Total Expired Batches" value={data?.summary?.TotalExpiredBatches || 0} icon={AlertTriangle} accent="rose" />
              <KPICard title="Expiring Soon (90d)"   value={data?.summary?.ExpiringSoonBatches || 0} icon={AlertTriangle} accent="amber" />
              <KPICard title="Low Stock Medicines"   value={data?.summary?.LowStockMedicines || 0}   icon={PackageMinus}  accent="orange" />
              <KPICard title="Fast Moving"           value={data?.summary?.FastMovingCount || 0}     icon={Activity}      accent="emerald" />
              <KPICard title="Dead Stock"            value={data?.summary?.DeadStockCount || 0}      icon={FileText}      accent="slate" />
            </div>


          <div className="grid grid-cols-1 gap-6">
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <Button variant={activeMedicineTab === 'expiry' ? 'default' : 'ghost'} size="sm" onClick={() => { onMedicineTabChange('expiry'); setMedicineCurrentPage(1); }}>
                    <AlertTriangle className="w-4 h-4 mr-2" /> Expiry Alerts
                  </Button>
                  <Button variant={activeMedicineTab === 'low_stock' ? 'default' : 'ghost'} size="sm" onClick={() => { onMedicineTabChange('low_stock'); setMedicineCurrentPage(1); }}>
                    <PackageMinus className="w-4 h-4 mr-2" /> Low Stock
                  </Button>
                  <Button variant={activeMedicineTab === 'moving' ? 'default' : 'ghost'} size="sm" onClick={() => { onMedicineTabChange('moving'); setMedicineCurrentPage(1); }}>
                    <Activity className="w-4 h-4 mr-2" /> Performance (Moving)
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Search medicine or batch..." 
                      className="pl-9 h-9 w-full rounded-full"
                      value={medicineSearchTerm}
                      onChange={(e) => {
                        setMedicineSearchTerm(e.target.value);
                        setMedicineCurrentPage(1);
                      }}
                    />
                  </div>
                  <select 
                    className="h-9 rounded-full border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={medicineCategoryFilter}
                    onChange={(e) => {
                      setMedicineCategoryFilter(e.target.value);
                      setMedicineCurrentPage(1);
                    }}
                  >
                    <option value="">All Categories</option>
                    {categories?.map((cat: any) => (
                      <option key={cat.CategoryId} value={cat.CategoryId}>{cat.CategoryName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm text-left">
                  
                  {activeMedicineTab === 'expiry' && (
                    <>
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium text-left w-12">#</th>
                          <th className="px-4 py-3 font-medium text-left">Medicine</th>
                          <th className="px-4 py-3 font-medium text-left">Batch</th>
                          <th className="px-4 py-3 font-medium text-left">Supplier</th>
                          <th className="px-4 py-3 font-medium text-right">Qty</th>
                          <th className="px-4 py-3 font-medium text-right">Expiry Date</th>
                          <th className="px-4 py-3 font-medium text-right">Days Left</th>
                          <th className="px-4 py-3 font-medium text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.expiry_items && data.expiry_items.length > 0 ? (
                          data.expiry_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-foreground text-left">{t.MedicineName}</td>
                              <td className="px-4 py-3 text-left">{t.BatchCode}</td>
                              <td className="px-4 py-3 text-left">{t.SupplierName || '-'}</td>
                              <td className="px-4 py-3 text-right">{t.Quantity}</td>
                              <td className="px-4 py-3 text-right">{new Date(t.ExpiryDate).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-right font-medium">{t.DaysToExpiry}</td>
                              <td className="px-4 py-3 text-left">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  t.Status === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {t.Status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No expiry alerts found.</td></tr>
                        )}
                      </tbody>
                    </>
                  )}

                  {activeMedicineTab === 'low_stock' && (
                    <>
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium text-left w-12">#</th>
                          <th className="px-4 py-3 font-medium text-left">Medicine</th>
                          <th className="px-4 py-3 font-medium text-left">Category</th>
                          <th className="px-4 py-3 font-medium text-left">Supplier</th>
                          <th className="px-4 py-3 font-medium text-right text-rose-600">Current Stock</th>
                          <th className="px-4 py-3 font-medium text-right">Reorder Level</th>
                          <th className="px-4 py-3 font-medium text-right">Deficit</th>
                          <th className="px-4 py-3 font-medium text-right text-emerald-600">Suggested Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.low_stock_items && data.low_stock_items.length > 0 ? (
                          data.low_stock_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-foreground text-left">{t.MedicineName}</td>
                              <td className="px-4 py-3 text-left">{t.Category}</td>
                              <td className="px-4 py-3 text-left">{t.SupplierName || '-'}</td>
                              <td className="px-4 py-3 text-right font-bold text-rose-600">{t.CurrentStock}</td>
                              <td className="px-4 py-3 text-right">{t.ReorderLevel}</td>
                              <td className="px-4 py-3 text-right">{t.Deficit}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600">{t.SuggestedReorderQty}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No low stock items found.</td></tr>
                        )}
                      </tbody>
                    </>
                  )}

                  {activeMedicineTab === 'moving' && (
                    <>
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium text-left w-12">#</th>
                          <th className="px-4 py-3 font-medium text-left">Medicine</th>
                          <th className="px-4 py-3 font-medium text-left">Category</th>
                          <th className="px-4 py-3 font-medium text-left">Supplier</th>
                          <th className="px-4 py-3 font-medium text-right">Sold Quantity</th>
                          <th className="px-4 py-3 font-medium text-right">Velocity (Units/Day)</th>
                          <th className="px-4 py-3 font-medium text-right">Revenue</th>
                          <th className="px-4 py-3 font-medium text-left">Classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.movement_items && data.movement_items.length > 0 ? (
                          data.movement_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-foreground text-left">{t.MedicineName}</td>
                              <td className="px-4 py-3 text-left">{t.Category}</td>
                              <td className="px-4 py-3 text-left">{t.SupplierName || '-'}</td>
                              <td className="px-4 py-3 text-right font-medium">{t.SoldQuantity}</td>
                              <td className="px-4 py-3 text-right">{t.SalesVelocity}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">Rs {t.Revenue.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3 text-left">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  t.Classification === 'Fast Moving' ? 'bg-emerald-100 text-emerald-700' : 
                                  t.Classification === 'Slow Moving' ? 'bg-amber-100 text-amber-700' : 
                                  t.Classification === 'Dead Stock' ? 'bg-slate-200 text-slate-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {t.Classification}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No movement data found for the selected period.</td></tr>
                        )}
                      </tbody>
                    </>
                  )}

                </table>
              </div>

              {data.pagination && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium">{(data.pagination.page - 1) * data.pagination.page_size + 1}</span> to <span className="font-medium">{Math.min(data.pagination.page * data.pagination.page_size, data.pagination.total)}</span> of <span className="font-medium">{data.pagination.total}</span> entries
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMedicineCurrentPage(p => Math.max(1, p - 1))}
                      disabled={data.pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMedicineCurrentPage(p => p + 1)}
                      disabled={data.pagination.page * data.pagination.page_size >= data.pagination.total}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
        );
      })()}

      {data && activeTab === 'financial' && (() => {
        const KPICard = ({ title, value, icon: Icon, accent }: { title: string; value: string | React.ReactNode; icon: any; accent: string }) => {
          const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
            blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
            emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
            purple:  { border: "border-l-purple-500",  iconCls: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
            amber:   { border: "border-l-amber-500",   iconCls: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
            indigo:  { border: "border-l-indigo-500",  iconCls: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          };
          const a = accentMap[accent] ?? accentMap.blue;
          return (
            <div className={`relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md ${a.border}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
                <Icon className={`w-5 h-5 ${a.iconCls}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
                <div className={`text-2xl font-extrabold leading-none tabular-nums truncate ${a.text}`}>{value}</div>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Summary KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 print:hidden">
              <KPICard title="Total Net Revenue"           value={`Rs ${data?.summary?.TotalRevenue?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`} icon={DollarSign} accent="blue" />
              <KPICard title="Cost of Goods Sold (COGS)"   value={`Rs ${data?.summary?.TotalCOGS?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`}    icon={ShoppingCart} accent="rose" />
              <KPICard 
                title="Net Profit"                  
                value={<span className={data?.summary?.NetProfit >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"}>{`Rs ${data?.summary?.NetProfit?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}`}</span>} 
                icon={TrendingUp} 
                accent="emerald" 
              />
              <KPICard 
                title="Profit Margin"               
                value={<span className={data?.summary?.ProfitMargin >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"}>{`${data?.summary?.ProfitMargin?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}%`}</span>}
                icon={TrendingUp} 
                accent="purple" 
              />
            </div>


          {/* Row 2: Charts */}
          <div className="grid gap-6 lg:grid-cols-2 print:hidden">
            
            <Card className="p-4 border border-border shadow-sm rounded-xl">
              <h3 className="font-semibold mb-4 text-center">Net Profit Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.trend_data || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : val;
                      }}
                    />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val/1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" name="Net Profit" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 border border-border shadow-sm rounded-xl">
              <h3 className="font-semibold mb-4 text-center">Revenue vs COGS vs Deductions</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Gross Profit', value: Math.max(0, data?.summary?.GrossProfit || 0) },
                        { name: 'COGS', value: data?.summary?.TotalCOGS || 0 },
                        { name: 'Inventory Loss', value: data?.summary?.InventoryLoss || 0 },
                        { name: 'Discounts & Returns', value: (data?.summary?.DiscountsApplied || 0) + (data?.summary?.SalesReturns || 0) }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[0, 1, 2, 3].map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      content={(props: any) => {
                        const { payload } = props;
                        const total = payload?.reduce((acc: number, entry: any) => acc + (entry.payload?.value || 0), 0) || 0;
                        return (
                          <ul className="flex flex-col gap-1.5 mt-2">
                            {payload?.map((entry: any, index: number) => {
                              const val = entry.payload?.value || 0;
                              const percent = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                              return (
                                <li key={`item-${index}`} className="flex items-center text-xs">
                                  <span className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-muted-foreground min-w-[120px] truncate" title={entry.value}>{entry.value}</span>
                                  <span className="ml-auto font-medium text-foreground whitespace-nowrap">
                                    Rs {val.toLocaleString()} <span className="text-muted-foreground ml-1">({percent}%)</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

          </div>

          {/* Row 3: Data Tables */}
          <div className="space-y-6">
            
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0">
              {/* Print Header */}
              <div className="hidden print:block text-center mb-6 border-b-2 border-slate-800 pb-4">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-widest">CarePlus Pharmacy</h1>
                <h2 className="text-xl font-bold text-slate-800 mt-2">Profit & Loss Statement</h2>
                <p className="text-sm text-slate-600 mt-1">Reporting Period: {timeframe === 'custom' && dateRange ? `${dateRange.start} to ${dateRange.end}` : timeframe.replace('_', ' ').toUpperCase()}</p>
              </div>

              <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center print:hidden">
                <h3 className="font-semibold text-lg flex items-center">
                  <FileSpreadsheet className="w-5 h-5 mr-2 text-primary" />
                  Profit & Loss Statement
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden h-9">
                    <Printer className="w-4 h-4 mr-2" />
                    Print P&L Statement
                  </Button>
                </div>
              </div>
              
              <div className="p-0">
                <table className="w-full text-sm text-left">
                  <tbody className="divide-y divide-border">
                    {/* 1. Revenue (Income) Section */}
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td colSpan={2} className="px-6 py-2.5 font-bold text-foreground">1. Revenue (Income)</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-2.5 text-muted-foreground pl-10">Gross Sales Revenue</td>
                      <td className="px-6 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">+ Rs {data?.summary?.GrossSales?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-2.5 text-muted-foreground pl-10">Less: Sales Returns & Refunds</td>
                      <td className="px-6 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400">- Rs {data?.summary?.SalesReturns?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-2.5 text-muted-foreground pl-10">Less: Discounts Given</td>
                      <td className="px-6 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400">- Rs {data?.summary?.DiscountsApplied?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>
                    <tr className="border-t-2 border-border bg-blue-50/30 dark:bg-blue-900/10">
                      <td className="px-6 py-3 font-bold text-right text-blue-700 dark:text-blue-400">Subtotal: Net Revenue</td>
                      <td className="px-6 py-3 text-right font-bold text-blue-700 dark:text-blue-400">Rs {data?.summary?.TotalRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>

                    {/* 2. Cost of Goods Sold (COGS) Section */}
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td colSpan={2} className="px-6 py-2.5 font-bold text-foreground">2. Cost of Goods Sold (COGS)</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-2.5 text-muted-foreground pl-10">Direct Cost of Sold Medicines</td>
                      <td className="px-6 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400">- Rs {data?.summary?.TotalCOGS?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>
                    <tr className="border-t-2 border-border bg-slate-100 dark:bg-slate-800/50">
                      <td className="px-6 py-3 font-bold text-right text-foreground">Subtotal: Gross Profit</td>
                      <td className="px-6 py-3 text-right font-bold text-foreground">Rs {data?.summary?.GrossProfit?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>

                    {/* 3. Expenses & Operational Losses Section */}
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td colSpan={2} className="px-6 py-2.5 font-bold text-foreground">3. Expenses & Operational Losses</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-2.5 text-muted-foreground pl-10">Inventory Expiry & Write-Offs</td>
                      <td className="px-6 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400">- Rs {data?.summary?.InventoryLoss?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-2.5 text-muted-foreground pl-10">Operating Expenses (Rent, Utilities, etc.)</td>
                      <td className="px-6 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400">- Rs {data?.summary?.TotalExpenses?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</td>
                    </tr>

                    {/* 4. Final Summary Footer */}
                    <tr className="border-t-4 border-double border-border bg-slate-100 dark:bg-slate-900/80">
                      <td className="px-6 py-5 font-black text-lg text-right">NET PROFIT / LOSS</td>
                      <td className={`px-6 py-5 text-right font-black text-2xl ${data?.summary?.NetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                        {data?.summary?.NetProfit >= 0 ? '+ ' : '- '}Rs {Math.abs(data?.summary?.NetProfit || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
        </div>
        );
      })()}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
              <DialogDescription>
                Details for {selectedInvoice.InvoiceNo}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 py-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoice No.</p>
                <p className="font-semibold text-foreground">{selectedInvoice.InvoiceNo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Transaction Date</p>
                <p className="font-semibold text-foreground">{new Date(selectedInvoice.TransactionDate).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                <p className="font-semibold text-foreground">{selectedInvoice.CustomerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Payment Method</p>
                <p className="font-semibold text-foreground">{selectedInvoice.PaymentMethod || 'N/A'}</p>
              </div>
              <div className="col-span-2 border-t border-border my-2"></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Items / Qty</p>
                <p className="font-semibold text-foreground">{selectedInvoice.MedicinesSold} Items <span className="text-muted-foreground font-normal ml-1">({selectedInvoice.TotalQty} units)</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedInvoice.Status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {selectedInvoice.Status}
                </span>
              </div>
              <div className="col-span-2 bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mt-2 flex justify-between items-center border border-border">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Profit</p>
                  <p className="font-bold text-emerald-600 text-xl">Rs {selectedInvoice.Profit ? selectedInvoice.Profit.toLocaleString() : '0'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Grand Total</p>
                  <p className="font-bold text-foreground text-2xl">Rs {selectedInvoice.GrandTotal?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
