"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";
import {
  Pill,
  Package,
  CircleDollarSign,
  AlertTriangle,
  CalendarDays,
  Box,
  Search,
  RefreshCcw,
  Download,
  Plus,
  Eye,
  Edit,
  History,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InventorySummary {
  total_medicines: number;
  total_stock_quantity: number;
  inventory_value: number;
  low_stock_items: number;
  expiring_medicines: number;
  out_of_stock_medicines: number;
  overstock_items: number;
}

interface StockBatch {
  BatchId: number;
  MedicineId: number;
  CodeBarcode: string;
  MedicineName: string;
  CategoryName: string;
  CompanyName: string;
  SupplierName: string;
  BatchCode: string;
  RackNumber: string;
  ExpiryDate: string;
  PurchasePrice: number;
  SellingPrice: number;
  CurrentStock: number;
  MinStock: number;
  Status: string;
  StockValue: number;
  LastPurchaseDate: string;
  LastSaleDate: string | null;
}

interface StockAdjustment {
  AdjustmentId: number;
  BatchId: number;
  MedicineName: string;
  BatchCode: string;
  AdjustmentType: string;
  Quantity: number;
  Reason: string;
  AdjustmentDate: string;
  UserName: string;
}

interface ExpiryTrack {
  BatchId: number;
  MedicineName: string;
  CategoryName: string;
  SupplierName: string;
  BatchCode: string;
  CurrentStock: number;
  ExpiryDate: string;
  DaysToExpiry: number;
  ExpiryStatus: string;
}

interface StockMovement {
  Date: string;
  MedicineName: string;
  BatchCode: string;
  MovementType: string;
  QuantityChange: number;
  Reference: string;
  UserName: string;
}

interface AuditLogEntry {
  LogId: number;
  Timestamp: string;
  Action: string;
  Description: string;
  UserName: string;
}

export default function InventoryManagementPage() {
  const [summary, setSummary] = useState<InventorySummary>({
    total_medicines: 0,
    total_stock_quantity: 0,
    inventory_value: 0,
    low_stock_items: 0,
    expiring_medicines: 0,
    out_of_stock_medicines: 0,
    overstock_items: 0
  });

  const [stockList, setStockList] = useState<StockBatch[]>([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState<StockAdjustment[]>([]);
  const [expiryList, setExpiryList] = useState<ExpiryTrack[]>([]);
  const [movementList, setMovementList] = useState<StockMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("current");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Movement Filters
  const [movBatchFilter, setMovBatchFilter] = useState("");
  const [movTypeFilter, setMovTypeFilter] = useState("");
  const [movStartDate, setMovStartDate] = useState("");
  const [movEndDate, setMovEndDate] = useState("");

  // Side Panel & Modals
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({ BatchId: 0, Type: "Decrease", Quantity: "", Reason: "" });

  // F2 global shortcut → open Stock Adjustment modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        openAdjustmentModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const statusParam = params.get('status');
      
      if (tabParam) setActiveTab(tabParam);
      if (statusParam) setStatusFilter(statusParam);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sumRes = await apiClient.get("/inventory/summary");
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
      
      const stockRes = await apiClient.get(`/inventory/stock?status=${statusFilter}&search=${searchQuery}`);
      if (stockRes.success && stockRes.data) {
        setStockList(stockRes.data);
      }
      
      const adjRes = await apiClient.get(`/inventory/adjustments`);
      if (adjRes.success && adjRes.data) {
        setAdjustmentHistory(adjRes.data);
      }
      
      const expRes = await apiClient.get(`/inventory/expiry?days=90`);
      if (expRes.success && expRes.data) {
        setExpiryList(expRes.data);
      }

      // Build movement query string
      let movQuery = [];
      if (movBatchFilter) movQuery.push(`batch_code=${movBatchFilter}`);
      if (movTypeFilter) movQuery.push(`movement_type=${movTypeFilter}`);
      if (movStartDate) movQuery.push(`start_date=${movStartDate}`);
      if (movEndDate) movQuery.push(`end_date=${movEndDate}`);
      
      const movRes = await apiClient.get(`/inventory/movements?${movQuery.join("&")}`);
      if (movRes.success && movRes.data) {
        setMovementList(movRes.data);
      }

      const auditRes = await apiClient.get(`/inventory/audit-logs`);
      if (auditRes.success && auditRes.data) {
        setAuditLogs(auditRes.data);
      }
    } catch (error) {
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]); // Refetch on filter change. For search, we can use a debounce or button.

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchData();
    }
  };

  const handleStockAdjustment = async () => {
    if (!adjustData.BatchId) return toast.error("Please select a batch");
    if (!adjustData.Quantity || isNaN(Number(adjustData.Quantity)) || Number(adjustData.Quantity) <= 0) return toast.error("Enter a valid quantity > 0");
    if (adjustData.Reason.length < 5) return toast.error("Please provide a valid justification reason (min 5 chars)");

    try {
      const res = await apiClient.post("/inventory/adjust", {
        BatchId: adjustData.BatchId,
        AdjustmentType: adjustData.Type,
        Quantity: Number(adjustData.Quantity),
        Reason: adjustData.Reason
      });

      if (res.success) {
        toast.success(res.message);
        setIsAdjustModalOpen(false);
        setAdjustData({ BatchId: 0, Type: "Decrease", Quantity: "", Reason: "" });
        if (selectedBatch && selectedBatch.BatchId === adjustData.BatchId) {
            setSelectedBatch({
                ...selectedBatch,
                CurrentStock: adjustData.Type === "Increase" 
                    ? selectedBatch.CurrentStock + Number(adjustData.Quantity)
                    : selectedBatch.CurrentStock - Number(adjustData.Quantity)
            });
        }
        fetchData();
      } else {
        toast.error(res.message || "Failed to adjust stock");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "An error occurred");
    }
  };

  const openAdjustmentModal = (batch?: StockBatch) => {
    if (batch) {
        setAdjustData({ BatchId: batch.BatchId, Type: "Decrease", Quantity: "", Reason: "" });
    } else {
        setAdjustData({ BatchId: 0, Type: "Decrease", Quantity: "", Reason: "" });
    }
    setIsAdjustModalOpen(true);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return toast.error("No data to export");
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(fieldName => `"${String(row[fieldName]).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    window.print();
  };

  // Navigate to Movement History tab and pre-fill batch filter
  const goToHistoryForBatch = (batchCode: string) => {
    setMovBatchFilter(batchCode);
    setActiveTab("history");
  };

  const tabs = [
    { id: "current", label: "Current Stock" },
    { id: "adjustments", label: "Stock Adjustments" },
    { id: "history", label: "Stock Movement History" },
    { id: "expiry", label: "Expiry Tracking" },
    { id: "audit", label: "Audit Logs" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-background overflow-hidden print-container">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6 print-content">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor stock levels, manage inventory movements, track medicine expiry, and maintain accurate stock records.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
          <KPICard title="Total Medicines"  value={summary.total_medicines}                                                              icon={<Pill           className="h-6 w-6" />} accent="blue"    />
          <KPICard title="Total Stock Qty"  value={summary.total_stock_quantity.toLocaleString()}                                       icon={<Package        className="h-6 w-6" />} accent="emerald" />
          <KPICard title="Inventory Value"  value={`Rs ${summary.inventory_value.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={<CircleDollarSign className="h-6 w-6" />} accent="purple"  />
          <KPICard title="Low Stock"        value={summary.low_stock_items}                                                              icon={<AlertTriangle  className="h-6 w-6" />} accent="orange"  />
          <KPICard title="Expiring (90d)"   value={summary.expiring_medicines}                                                           icon={<CalendarDays   className="h-6 w-6" />} accent="amber"   />
          <KPICard title="Overstock"        value={summary.overstock_items}                                                              icon={<Package        className="h-6 w-6" />} accent="indigo"  />
          <KPICard title="Out of Stock"     value={summary.out_of_stock_medicines}                                                       icon={<Box            className="h-6 w-6" />} accent="rose"    />
        </div>

        {/* Tabs & Actions */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-border pb-4 mb-6">
          <div className="flex space-x-1 bg-secondary/50 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id 
                    ? "bg-white dark:bg-card text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-card/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => openAdjustmentModal()} variant="outline" className="h-9 border-primary/20 text-primary hover:bg-primary/5">
              <Plus className="h-4 w-4 mr-2" /> Stock Adjustment
            </Button>
            <Button variant="outline" className="h-9">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button variant="outline" className="h-9" onClick={fetchData}>
              <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        {/* Current Stock Tab Content */}
        {activeTab === "current" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
            
            {/* Filter Bar */}
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap gap-3 items-center">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by medicine, barcode, batch..." 
                  className="h-9 pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                <select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="All">Category: All</option>
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="All">Company: All</option>
                </select>
                <select 
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">Stock Status: All</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Overstock">Overstock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse min-w-[1200px]">
                <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold min-w-[140px]">Code / Barcode</th>
                    <th className="px-4 py-3 font-semibold">Medicine Name</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Rack / Shelf</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Batch No.</th>
                    <th className="px-4 py-3 font-semibold">Expiry Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Pur. Price</th>
                    <th className="px-4 py-3 font-semibold text-right">Sell. Price</th>
                    <th className="px-4 py-3 font-semibold text-right">Current Stock</th>
                    <th className="px-4 py-3 font-semibold text-right">Min. Stock</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">Loading inventory...</td></tr>
                  ) : stockList.length === 0 ? (
                    <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">No stock batches found.</td></tr>
                  ) : (
                    stockList.map((item, idx) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const expiryDate = new Date(item.ExpiryDate);
                      expiryDate.setHours(0, 0, 0, 0);
                      const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysToExpiry < 0;
                      const isNearExpiry = !isExpired && daysToExpiry <= 90;

                      return (
                        <tr key={item.BatchId} className={cn(
                          "transition-colors",
                          isExpired
                            ? "bg-rose-50/40 hover:bg-rose-100/50 dark:bg-rose-950/10 dark:hover:bg-rose-900/20"
                            : isNearExpiry
                            ? "bg-amber-50/30 hover:bg-amber-100/40 dark:bg-amber-950/10 dark:hover:bg-amber-900/20"
                            : "hover:bg-secondary/10"
                        )}>
                          <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono text-xs min-w-[140px]">{item.CodeBarcode}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{item.MedicineName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.CategoryName}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-secondary/60 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-border">
                              {item.RackNumber || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.CompanyName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-primary">{item.BatchCode}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span
                                title={isExpired ? "This batch has expired" : isNearExpiry ? `Expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"}` : ""}
                                className={cn(
                                  "font-semibold text-xs",
                                  isExpired
                                    ? "text-rose-600 dark:text-rose-400"
                                    : isNearExpiry
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-600 dark:text-slate-300"
                                )}
                              >
                                {expiryDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                              {isExpired && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  Expired
                                </span>
                              )}
                              {isNearExpiry && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  Near Expiry
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">Rs {item.PurchasePrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">Rs {item.SellingPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums">{item.CurrentStock}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{item.MinStock}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                              item.Status === "In Stock" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              item.Status === "Overstock" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                              item.Status === "Low Stock" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                            )}>
                              {item.Status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setSelectedBatch(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                title="View stock movement history for this batch"
                                onClick={() => goToHistoryForBatch(item.BatchCode)}
                                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                              >
                                <History className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground bg-slate-50/50 dark:bg-secondary/20">
              <div>Showing 1 to {stockList.length} of {summary.total_medicines} entries</div>
              {/* Pagination Placeholder */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>«</Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>‹</Button>
                <Button variant="default" size="sm" className="h-8 w-8 p-0 bg-primary text-primary-foreground">1</Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">›</Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">»</Button>
              </div>
            </div>
            
          </div>
        )}
        
        {activeTab === "adjustments" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Stock Adjustment History</h3>
              <Button onClick={() => openAdjustmentModal()} className="bg-primary hover:bg-primary/90 text-white h-9">
                <Plus className="h-4 w-4 mr-2" /> New Adjustment
              </Button>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Medicine</th>
                    <th className="px-4 py-3 font-semibold">Batch No.</th>
                    <th className="px-4 py-3 font-semibold text-center">Type</th>
                    <th className="px-4 py-3 font-semibold text-center">Quantity</th>
                    <th className="px-4 py-3 font-semibold">Reason / Justification</th>
                    <th className="px-4 py-3 font-semibold">Adjusted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading history...</td></tr>
                  ) : adjustmentHistory.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No stock adjustments found.</td></tr>
                  ) : (
                    adjustmentHistory.map(adj => (
                      <tr key={adj.AdjustmentId} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(adj.AdjustmentDate).toLocaleString('en-GB', { day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{adj.MedicineName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{adj.BatchCode}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            adj.AdjustmentType === "Increase" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {adj.AdjustmentType}
                          </span>
                        </td>
                        <td className={cn("px-4 py-3 text-center font-bold", adj.AdjustmentType === "Increase" ? "text-emerald-600" : "text-rose-500")}>
                          {adj.AdjustmentType === "Increase" ? "+" : "-"}{adj.Quantity}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate" title={adj.Reason}>{adj.Reason}</td>
                        <td className="px-4 py-3 text-muted-foreground">{adj.UserName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "expiry" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-rose-500" /> Expiry Tracking (Next 90 Days)
              </h3>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">Medicine</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Batch No.</th>
                    <th className="px-4 py-3 font-semibold text-center">Stock Remaining</th>
                    <th className="px-4 py-3 font-semibold">Expiry Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading expiry data...</td></tr>
                  ) : expiryList.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No expiring medicines in the next 90 days.</td></tr>
                  ) : (
                    expiryList.map(item => (
                      <tr key={item.BatchId} className={cn(
                        "transition-colors",
                        item.DaysToExpiry < 0 ? "bg-rose-50/50 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:hover:bg-rose-900/30" : "hover:bg-secondary/10"
                      )}>
                        <td className="px-4 py-3 font-semibold text-foreground">{item.MedicineName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.CategoryName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{item.BatchCode}</td>
                        <td className="px-4 py-3 text-center font-bold">{item.CurrentStock}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "font-medium", 
                            item.DaysToExpiry < 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-amber-600 dark:text-amber-400"
                          )}>
                            {new Date(item.ExpiryDate).toLocaleDateString('en-GB', { day:'2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-bold uppercase",
                            item.DaysToExpiry < 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" :
                            item.DaysToExpiry < 30 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          )}>
                            {item.ExpiryStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Input 
                  placeholder="Batch Code..." 
                  className="h-9 w-40"
                  value={movBatchFilter}
                  onChange={(e) => setMovBatchFilter(e.target.value)}
                />
                <select 
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={movTypeFilter}
                  onChange={(e) => setMovTypeFilter(e.target.value)}
                >
                  <option value="">All Movements</option>
                  <option value="Purchase">Purchases (IN)</option>
                  <option value="Sale">Sales (OUT)</option>
                  <option value="Adjustment">Adjustments</option>
                  <option value="Return">Returns (OUT)</option>
                </select>
                <div className="flex items-center gap-1">
                    <Input type="date" className="h-9 w-36" value={movStartDate} onChange={(e) => setMovStartDate(e.target.value)} />
                    <span className="text-muted-foreground">-</span>
                    <Input type="date" className="h-9 w-36" value={movEndDate} onChange={(e) => setMovEndDate(e.target.value)} />
                </div>
                <Button onClick={fetchData} variant="outline" size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-white border-0">
                  <Search className="h-4 w-4 mr-1" /> Filter
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => exportToCSV(movementList, 'stock_movements')} variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar" id="print-area">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Medicine</th>
                    <th className="px-4 py-3 font-semibold">Batch No.</th>
                    <th className="px-4 py-3 font-semibold text-center">Type</th>
                    <th className="px-4 py-3 font-semibold text-center">Qty Change</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading movements...</td></tr>
                  ) : movementList.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No stock movements found for the selected criteria.</td></tr>
                  ) : (
                    movementList.map((mov, idx) => (
                      <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(mov.Date).toLocaleString('en-GB', { day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{mov.MedicineName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{mov.BatchCode}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            mov.MovementType === "Purchase" ? "bg-emerald-100 text-emerald-700" : 
                            mov.MovementType === "Sale" ? "bg-blue-100 text-blue-700" :
                            mov.MovementType === "Return" ? "bg-rose-100 text-rose-700" :
                            "bg-amber-100 text-amber-700"
                          )}>
                            {mov.MovementType}
                          </span>
                        </td>
                        <td className={cn(
                            "px-4 py-3 text-center font-bold text-lg", 
                            mov.QuantityChange > 0 ? "text-emerald-600" : "text-rose-500"
                        )}>
                          {mov.QuantityChange > 0 ? "+" : ""}{mov.QuantityChange}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate" title={mov.Reference}>{mov.Reference}</td>
                        <td className="px-4 py-3 text-muted-foreground">{mov.UserName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-500" /> Immutable Audit Logs
              </h3>
              <div className="flex gap-2">
                <Button onClick={() => exportToCSV(auditLogs, 'audit_logs')} variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar" id="print-area">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">Log ID</th>
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading audit logs...</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit logs found.</td></tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.LogId} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">#{log.LogId}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(log.Timestamp).toLocaleString('en-GB', { day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{log.Action}</td>
                        <td className="px-4 py-3 text-foreground break-words max-w-md">{log.Description}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.UserName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Placeholders for other tabs */}
        {activeTab !== "current" && activeTab !== "adjustments" && activeTab !== "expiry" && activeTab !== "history" && activeTab !== "audit" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-16 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-xl font-semibold text-foreground mb-2">Module Under Construction</h2>
            <p className="text-muted-foreground">The {tabs.find(t=>t.id===activeTab)?.label} section is coming soon.</p>
          </div>
        )}

      </div>

      {/* --- DETAILS SIDE PANEL --- */}
      {selectedBatch && (
        <div className="absolute inset-y-0 right-0 w-[400px] bg-white dark:bg-card shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-300 z-50">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-semibold text-lg">Medicine Details</h3>
            <button onClick={() => setSelectedBatch(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* Header / Badge Info */}
            <div className="flex gap-4 items-start">
              <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
                <Pill className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <h4 className="font-bold text-lg leading-tight">{selectedBatch.MedicineName}</h4>
                <div className="mt-2">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    selectedBatch.Status === "In Stock" ? "bg-emerald-100 text-emerald-700" :
                    selectedBatch.Status === "Overstock" ? "bg-indigo-100 text-indigo-700" :
                    selectedBatch.Status === "Low Stock" ? "bg-orange-100 text-orange-700" :
                    "bg-rose-100 text-rose-700"
                  )}>
                    {selectedBatch.Status}
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground font-mono">
                  <span>Code: {selectedBatch.CodeBarcode}</span>
                </div>
              </div>
            </div>

            {/* General Info */}
            <div>
              <h5 className="text-sm font-semibold border-b border-border pb-2 mb-3">Medicine Information</h5>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span> <span className="font-medium text-right">{selectedBatch.CategoryName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Company</span> <span className="font-medium text-right">{selectedBatch.CompanyName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span> <span className="font-medium text-right">{selectedBatch.SupplierName}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Rack / Shelf</span>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-secondary/60 border border-slate-200 dark:border-border px-2 py-0.5 rounded">{selectedBatch.RackNumber || "—"}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Batch Number</span> <span className="font-mono text-xs bg-secondary/50 px-2 py-0.5 rounded">{selectedBatch.BatchCode}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Expiry Date</span>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const exp = new Date(selectedBatch.ExpiryDate); exp.setHours(0,0,0,0);
                      const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
                      const expired = days < 0;
                      const near = !expired && days <= 90;
                      return (
                        <>
                          <span className={cn("font-semibold text-sm", expired ? "text-rose-600 dark:text-rose-400" : near ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                            {exp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          {expired && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">Expired</span>}
                          {near && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Near Expiry</span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span> <span className="font-medium">Rs {selectedBatch.PurchasePrice.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Selling Price</span> <span className="font-medium">Rs {selectedBatch.SellingPrice.toFixed(2)}</span></div>
              </div>
            </div>

            {/* Stock Details */}
            <div>
              <h5 className="text-sm font-semibold border-b border-border pb-2 mb-3">Stock Details</h5>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Current Stock</span> <span className="font-bold text-emerald-600 text-lg">{selectedBatch.CurrentStock}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Minimum Stock</span> <span className="font-medium">{selectedBatch.MinStock}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stock Value</span> <span className="font-bold text-foreground">Rs {selectedBatch.StockValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h5 className="text-sm font-semibold border-b border-border pb-2 mb-3">Timestamps</h5>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Last Purchase Date</span> 
                  <span className="font-medium">{new Date(selectedBatch.LastPurchaseDate).toLocaleDateString('en-GB', { day:'2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Last Sale Date</span> 
                  <span className="font-medium">{selectedBatch.LastSaleDate ? new Date(selectedBatch.LastSaleDate).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>

          </div>
          
          <div className="p-4 border-t border-border grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-secondary/20">
            <Button onClick={() => openAdjustmentModal(selectedBatch)} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Edit className="h-4 w-4 mr-2" /> Adjust Stock
            </Button>
            <Button
              variant="outline"
              className="w-full bg-white dark:bg-card"
              onClick={() => selectedBatch && goToHistoryForBatch(selectedBatch.BatchCode)}
            >
              <History className="h-4 w-4 mr-2" /> View History
            </Button>
          </div>
        </div>
      )}
      
      {/* Overlay for Side Panel */}
      {selectedBatch && (
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm z-40" 
          onClick={() => setSelectedBatch(null)}
        />
      )}

      {/* --- STOCK ADJUSTMENT MODAL --- */}
      {isAdjustModalOpen && (
        <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-secondary/20">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Stock Adjustment
              </h2>
              <button onClick={() => setIsAdjustModalOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Select Batch <span className="text-rose-500">*</span></label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={adjustData.BatchId}
                  onChange={(e) => setAdjustData({...adjustData, BatchId: Number(e.target.value)})}
                  disabled={!!(selectedBatch && selectedBatch.BatchId === adjustData.BatchId)}
                >
                  <option value={0}>-- Select Medicine Batch --</option>
                  {stockList.map(batch => (
                    <option key={batch.BatchId} value={batch.BatchId}>
                      {batch.MedicineName} (Batch: {batch.BatchCode}) - Stock: {batch.CurrentStock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Adjustment Type <span className="text-rose-500">*</span></label>
                  <select 
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      adjustData.Type === "Increase" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20" : "bg-rose-50 text-rose-700 dark:bg-rose-900/20"
                    )}
                    value={adjustData.Type}
                    onChange={(e) => setAdjustData({...adjustData, Type: e.target.value})}
                  >
                    <option value="Decrease">Decrease (-)</option>
                    <option value="Increase">Increase (+)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Quantity <span className="text-rose-500">*</span></label>
                  <Input 
                    type="number" min="1"
                    placeholder="E.g. 5"
                    className="h-10"
                    value={adjustData.Quantity}
                    onChange={(e) => setAdjustData({...adjustData, Quantity: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Written Justification Reason <span className="text-rose-500">*</span></label>
                <textarea 
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                  placeholder="E.g. 2 bottles broken during transit, or 1 box found expired during stock count..."
                  value={adjustData.Reason}
                  onChange={(e) => setAdjustData({...adjustData, Reason: e.target.value})}
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  This action generates a permanent immutable audit log entry.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>Cancel</Button>
              <Button onClick={handleStockAdjustment} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
                Confirm Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Accent colour map for KPI Cards
const accentMap: Record<string, { border: string; icon: string; text: string; bg: string }> = {
  blue:    { border: "border-l-blue-500",    icon: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  emerald: { border: "border-l-emerald-500", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  purple:  { border: "border-l-purple-500",  icon: "text-purple-500",  text: "text-purple-600 dark:text-purple-400",  bg: "bg-purple-50 dark:bg-purple-900/20" },
  orange:  { border: "border-l-orange-500",  icon: "text-orange-500",  text: "text-orange-600 dark:text-orange-400",  bg: "bg-orange-50 dark:bg-orange-900/20" },
  amber:   { border: "border-l-amber-500",   icon: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  indigo:  { border: "border-l-indigo-500",  icon: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  rose:    { border: "border-l-rose-500",    icon: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-900/20" },
};

// High-contrast KPI Card — no trend subtitles, strong colour accents
function KPICard({ title, value, icon, accent = "blue" }: { title: string; value: string | number; icon: React.ReactNode; accent?: string }) {
  const a = accentMap[accent] ?? accentMap.blue;
  return (
    <div className={cn(
      "relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-shadow hover:shadow-md",
      a.border
    )}>
      {/* Icon */}
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.bg)}>
        <span className={a.icon}>{icon}</span>
      </div>
      {/* Metric */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
        <p className={cn("text-2xl font-extrabold leading-none tabular-nums", a.text)}>{value}</p>
      </div>
    </div>
  );
}
