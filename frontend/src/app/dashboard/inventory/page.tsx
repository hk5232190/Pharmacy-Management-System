"use client";

import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  X,
  Check,
  ChevronDown,
  FileText,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useRouter } from "next/navigation";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";


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
  PreviousQuantity: number;
  NewQuantity: number;
  Reason: string;
  AdjustmentDate: string;
  UserName: string;
}

interface ExpiryItem {
  BatchId: number;
  MedicineName: string;
  CategoryName: string;
  SupplierName: string;
  BatchCode: string;
  CurrentStock: number;
  PurchasePrice: number;
  ValueAtRisk: number;
  ExpiryDate: string;
  DaysToExpiry: number;
  ExpiryStatus: string;
}

interface ExpiryKpiSummary {
  expired_count: number;
  expired_value: number;
  expiring_30d_count: number;
  expiring_30d_value: number;
  expiring_90d_count: number;
  expiring_90d_value: number;
}

interface StockMovement {
  Date: string;
  MedicineName: string;
  BatchCode: string;
  Barcode?: string;
  MovementType: string;
  QuantityChange: number;
  BalanceStock: number;
  Reference: string;
  SourceId?: number;
}

interface AuditLogEntry {
  LogId: number;
  Timestamp: string;
  Action: string;
  Description: string;
  UserName: string;
}

export default function InventoryManagementPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  const [activeTab, setActiveTab] = useState("current");
  
  const handleRefresh = () => {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    setRefreshKey(k => k + 1);
    setTimeout(() => {
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1500);
    }, 400);
  };

  return <InventoryManagementPageInner key={refreshKey} refreshState={refreshState} onRefresh={handleRefresh} activeTab={activeTab} onTabChange={setActiveTab} />;
}

function InventoryManagementPageInner({ onRefresh, refreshState, activeTab, onTabChange }: { onRefresh: () => void, refreshState: "idle" | "loading" | "done", activeTab: string, onTabChange: (tab: string) => void }) {
  const { formatCurrency, currencySymbol, triggerNotification } = useSystemPreferences();
  const { profile } = useProfile();
  const router = useRouter();
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
  const [expiryItems, setExpiryItems] = useState<ExpiryItem[]>([]);
  const [expiryKpi, setExpiryKpi] = useState<ExpiryKpiSummary | null>(null);
  const [expiryTotal, setExpiryTotal] = useState(0);
  const [expiryTimeframe, setExpiryTimeframe] = useState(30);
  const [expirySearch, setExpirySearch] = useState("");
  const [expirySupplierFilter, setExpirySupplierFilter] = useState("All");
  const [expiryPage, setExpiryPage] = useState(1);
  const expiryPageSize = 15;
  const [movementList, setMovementList] = useState<StockMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // (activeTab is now managed by the wrapper so it survives a refresh reset)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");

  // Master Lists for Filters
  const [masterCategories, setMasterCategories] = useState<{CategoryId: number, CategoryName: string}[]>([]);
  const [masterCompanies, setMasterCompanies] = useState<{CompanyId: number, CompanyName: string}[]>([]);
  const [masterSuppliers, setMasterSuppliers] = useState<{SupplierId: number, Name: string}[]>([]);
  
  // Movement Filters
  const [movSearchQuery, setMovSearchQuery] = useState("");
  const [movBatchFilter, setMovBatchFilter] = useState("");
  const [movTypeFilter, setMovTypeFilter] = useState("");
  const [movStartDate, setMovStartDate] = useState("");
  const [movEndDate, setMovEndDate] = useState("");

  // Side Panel & Modals
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({ BatchId: 0, Type: "Increase", Quantity: "", Reason: "", Notes: "" });
  const [adjustBatchLabel, setAdjustBatchLabel] = useState("");

  // Edit Stock Batch Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);
  const [editFormData, setEditFormData] = useState({
    BatchCode: "",
    ExpiryDate: "",
    PurchasePrice: "",
    SellingPrice: "",
    CurrentStock: "",
    RackNumber: "",
    MinStock: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Adjustment History Pagination & Filters
  const [adjSearchQuery, setAdjSearchQuery] = useState("");
  const [adjTypeFilter, setAdjTypeFilter] = useState("All");
  const [adjStartDate, setAdjStartDate] = useState("");
  const [adjEndDate, setAdjEndDate] = useState("");
  const [adjPageSize, setAdjPageSize] = useState(10);
  const [adjCurrentPage, setAdjCurrentPage] = useState(1);

  // Export dropdown (stock tab only)
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Premium refresh state: 'idle' | 'loading' | 'done'
  // (refreshState is now managed by the wrapper)

  // Movement pagination
  const [movPageSize] = useState(20);
  const [movCurrentPage, setMovCurrentPage] = useState(1);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<{ type: string; id: number; ref: string } | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Client-side filtering for Category & Company
  const filteredStockList = stockList.filter(item => {
    if (categoryFilter !== "All" && item.CategoryName !== categoryFilter) return false;
    if (companyFilter !== "All" && item.CompanyName !== companyFilter) return false;
    return true;
  });

  // Use master data for dropdowns, sorted alphabetically
  const uniqueCategories = masterCategories.map(c => c.CategoryName).filter(Boolean).sort();
  const uniqueCompanies = masterCompanies.map(c => c.CompanyName).filter(Boolean).sort();

  // Current Stock pagination
  const [stockPageSize, setStockPageSize] = useState(10);
  const [stockCurrentPage, setStockCurrentPage] = useState(1);
  const totalStockPages = Math.max(1, Math.ceil(filteredStockList.length / stockPageSize));
  const pagedStockList = filteredStockList.slice((stockCurrentPage - 1) * stockPageSize, stockCurrentPage * stockPageSize);
  
  // Reset to page 1 whenever filtered list or page size changes
  useEffect(() => { setStockCurrentPage(1); }, [filteredStockList.length, stockPageSize]);

  // Client-side filtering for Adjustments
  const filteredAdjHistory = adjustmentHistory.filter(adj => {
    if (adjSearchQuery) {
      const q = adjSearchQuery.toLowerCase();
      if (!adj.MedicineName.toLowerCase().includes(q) && !adj.BatchCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (adjTypeFilter === "Additions (+)" && adj.AdjustmentType !== "Increase") return false;
    if (adjTypeFilter === "Deductions (-)" && adj.AdjustmentType !== "Decrease") return false;
    if (adjStartDate && new Date(adj.AdjustmentDate) < new Date(adjStartDate)) return false;
    if (adjEndDate && new Date(adj.AdjustmentDate) > new Date(adjEndDate + "T23:59:59")) return false;
    return true;
  });

  const totalAdjPages = Math.max(1, Math.ceil(filteredAdjHistory.length / adjPageSize));
  const pagedAdjHistory = filteredAdjHistory.slice((adjCurrentPage - 1) * adjPageSize, adjCurrentPage * adjPageSize);
  
  useEffect(() => { setAdjCurrentPage(1); }, [filteredAdjHistory.length, adjPageSize]);

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

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const statusParam = params.get('status');
      
      if (tabParam) onTabChange(tabParam);
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
      
      // Expiry data is now fetched via a separate effect/function (fetchExpiryData)
      // to avoid corrupting KPIs and allow standalone pagination.

      // Build movement query string
      let movQuery = [];
      if (movBatchFilter) movQuery.push(`batch_code=${encodeURIComponent(movBatchFilter)}`);
      if (movTypeFilter) movQuery.push(`movement_type=${encodeURIComponent(movTypeFilter)}`);
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

      // Fetch master lists for filters (page_size=0 gets all)
      const catRes = await apiClient.get("/categories?page_size=0");
      if (catRes.success && catRes.data) {
        setMasterCategories(catRes.data);
      }
      const compRes = await apiClient.get("/companies?page_size=0");
      if (compRes.success && compRes.data) {
        setMasterCompanies(compRes.data);
      }
      const suppRes = await apiClient.get("/suppliers?page_size=0");
      if (suppRes.success && suppRes.data) {
        setMasterSuppliers(suppRes.data);
      }

    } catch (error) {
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  const fetchExpiryData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(expiryTimeframe),
        page: String(expiryPage),
        page_size: String(expiryPageSize)
      });
      if (expirySearch) params.append("medicine_name", expirySearch);
      if (expirySupplierFilter !== "All") params.append("supplier_name", expirySupplierFilter);
      
      const res = await apiClient.get(`/inventory/expiry?${params.toString()}`);
      if (res.success && res.data) {
        setExpiryItems(res.data.items);
        setExpiryTotal(res.data.total);
        setExpiryKpi(res.data.kpi_summary);
      }
    } catch (error) {
      toast.error("Failed to load expiry data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "expiry") {
      fetchExpiryData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiryTimeframe, expiryPage, expirySearch, expirySupplierFilter, activeTab]);

  // (handleRefresh is now managed by the wrapper and passed as onRefresh prop)

  // Export current stock list to CSV
  const exportStockCSV = () => {
    if (!stockList.length) return toast.error("No data to export");
    const headers = [
      "#", "Barcode", "Medicine Name", "Category", "Company", "Rack/Shelf",
      "Batch No.", "Expiry Date", "Pur. Price (Rs)", "Sell. Price (Rs)",
      "Current Stock", "Min. Stock", "Status", "Stock Value (Rs)"
    ];
    const rows = stockList.map((item, idx) => [
      idx + 1,
      item.CodeBarcode,
      item.MedicineName,
      item.CategoryName,
      item.CompanyName,
      item.RackNumber || "—",
      item.BatchCode,
      new Date(item.ExpiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      item.PurchasePrice.toFixed(2),
      item.SellingPrice.toFixed(2),
      item.CurrentStock,
      item.MinStock,
      item.Status,
      item.StockValue.toFixed(2)
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_stock_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Stock list exported as CSV");
    setExportOpen(false);
  };

  // Export via a self-contained professional print window
  const exportStockPDF = () => {
    setExportOpen(false);
    if (!stockList.length) return toast.error("No data to export");

    const pharmName  = profile.PharmacyName || "Pharmacy Management System";
    const pharmAddr  = [profile.Address, profile.City, profile.State].filter(Boolean).join(", ") || "";
    const pharmPhone = profile.PhoneNumber || "";
    const printDate  = new Date().toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    const totalValue = stockList.reduce((s, i) => s + i.StockValue, 0);

    const statusColour = (s: string) => {
      if (s === "Out of Stock") return "#ef4444";
      if (s === "Low Stock")    return "#f59e0b";
      if (s === "Overstock")    return "#8b5cf6";
      return "#10b981";
    };
    const statusBg = (s: string) => {
      if (s === "Out of Stock") return "#fee2e2";
      if (s === "Low Stock")    return "#fef3c7";
      if (s === "Overstock")    return "#ede9fe";
      return "#d1fae5";
    };

    const rows = stockList.map((item, idx) => {
      const exp   = new Date(item.ExpiryDate);
      const today = new Date(); today.setHours(0,0,0,0);
      const days  = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      const expStr = exp.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
      const expColour = days < 0 ? "#ef4444" : days <= 90 ? "#f59e0b" : "#111827";
      const expExtra  = days < 0 ? " (Expired)" : days <= 90 ? ` (${days}d)` : "";
      return `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f9fafb"}">
          <td style="padding:8px 10px;color:#6b7280;font-size:11px">${idx + 1}</td>
          <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#111827">${item.CodeBarcode}</td>
          <td style="padding:8px 10px;font-weight:700;color:#111827;font-size:12px">${item.MedicineName}</td>
          <td style="padding:8px 10px;color:#374151;font-size:11px">${item.CategoryName}</td>
          <td style="padding:8px 10px;font-family:monospace;font-size:10px;color:#6366f1">${item.RackNumber || "—"}</td>
          <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#111827">${item.BatchCode}</td>
          <td style="padding:8px 10px;font-size:11px;color:${expColour};font-weight:600">${expStr}${expExtra}</td>
          <td style="padding:8px 10px;text-align:right;font-size:11px;color:#374151">${formatCurrency(item.PurchasePrice)}</td>
          <td style="padding:8px 10px;text-align:right;font-size:11px;color:#374151">${formatCurrency(item.SellingPrice)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:12px;color:#111827">${item.CurrentStock}</td>
          <td style="padding:8px 10px;text-align:right;color:#6b7280;font-size:11px">${item.MinStock}</td>
          <td style="padding:8px 10px;text-align:center">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${statusBg(item.Status)};color:${statusColour(item.Status)}">${item.Status}</span>
          </td>
          <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:11px">${formatCurrency(item.StockValue)}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inventory Stock Report — ${pharmName}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#111827; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size:A4 landscape; margin:12mm 10mm; }
    @media print { .no-print { display:none!important; } }
    table { width:100%; border-collapse:collapse; }
    thead tr th { background:#0f172a!important; color:#fff!important; padding:9px 10px; font-size:10px; text-transform:uppercase; letter-spacing:.06em; font-weight:700; white-space:nowrap; }
    tbody tr td { border-bottom:1px solid #e5e7eb; vertical-align:middle; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:20px 0; }
    .kpi { padding:12px 16px; border-radius:8px; border-left:4px solid; }
    .btn { display:inline-block; padding:8px 20px; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; margin-right:8px; }
    .btn-outline { background:#fff; color:#0f172a; border:1.5px solid #0f172a; }
  </style>
</head>
<body>
  <div style="max-width:100%;padding:0">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px 16px;background:#0f172a;color:#fff;border-radius:0">
      <div>
        <div style="font-size:22px;font-weight:900;letter-spacing:-.5px">${pharmName}</div>
        ${pharmAddr ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px">${pharmAddr}</div>` : ""}
        ${pharmPhone ? `<div style="font-size:11px;color:#94a3b8">${pharmPhone}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div style="font-size:26px;font-weight:900;color:#cbd5e1;letter-spacing:-1px;text-transform:uppercase">Stock Report</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">Generated: ${printDate}</div>
        <div style="font-size:11px;color:#94a3b8">Total Records: ${stockList.length}</div>
      </div>
    </div>

    <!-- KPI Summary -->
    <div class="kpi-grid" style="padding:0 24px">
      <div class="kpi" style="border-color:#3b82f6;background:#eff6ff">
        <div style="font-size:10px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.05em">Total Items</div>
        <div style="font-size:24px;font-weight:900;color:#1e40af;margin-top:2px">${stockList.length}</div>
      </div>
      <div class="kpi" style="border-color:#10b981;background:#ecfdf5">
        <div style="font-size:10px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.05em">Total Stock Value</div>
        <div style="font-size:20px;font-weight:900;color:#065f46;margin-top:2px">${formatCurrency(totalValue)}</div>
      </div>
      <div class="kpi" style="border-color:#f59e0b;background:#fffbeb">
        <div style="font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.05em">Low / Out of Stock</div>
        <div style="font-size:24px;font-weight:900;color:#92400e;margin-top:2px">${stockList.filter(i=>i.Status==="Low Stock"||i.Status==="Out of Stock").length}</div>
      </div>
      <div class="kpi" style="border-color:#8b5cf6;background:#f5f3ff">
        <div style="font-size:10px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:.05em">Overstock Items</div>
        <div style="font-size:24px;font-weight:900;color:#4c1d95;margin-top:2px">${stockList.filter(i=>i.Status==="Overstock").length}</div>
      </div>
    </div>

    <!-- Table -->
    <div style="padding:0 24px;margin-top:8px">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Barcode</th><th>Medicine Name</th><th>Category</th>
            <th>Rack</th><th>Batch</th><th>Expiry</th>
            <th style="text-align:right">Pur. Price</th><th style="text-align:right">Sell. Price</th>
            <th style="text-align:right">Stock</th><th style="text-align:right">Min</th>
            <th style="text-align:center">Status</th><th style="text-align:right">Value (Rs)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;margin-top:24px;border-top:2px solid #e5e7eb;font-size:10px;color:#9ca3af">
      <span>Pharmacy Management System — Confidential</span>
      <span>${pharmName} &nbsp;|&nbsp; ${printDate}</span>
    </div>

    <!-- Print / Close buttons (hidden on print) -->
    <div class="no-print" style="text-align:center;padding:20px;gap:10px;display:flex;justify-content:center">
      <button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button>
      <button class="btn btn-outline" onclick="window.close()">✕ Close</button>
    </div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return toast.error("Popup blocked — please allow popups for this site");
    win.document.write(html);
    win.document.close();
    toast.success("Print preview opened in new window");
  };

  // Debounced auto-search and filter change listener
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter]);

  const handleStockAdjustment = async () => {
    if (!adjustData.BatchId || adjustData.BatchId <= 0) return triggerNotification('warning', 'AlertTriggerErrors', "Please select a valid batch from the list");
    if (!adjustData.Quantity || isNaN(Number(adjustData.Quantity)) || Number(adjustData.Quantity) <= 0) return triggerNotification('warning', 'AlertTriggerErrors', "Enter a valid quantity > 0");
    if (!adjustData.Reason) return triggerNotification('warning', 'AlertTriggerErrors', "Please select a justification reason");

    const currentStock = stockList.find(b => b.BatchId === adjustData.BatchId)?.CurrentStock || 0;
    if (adjustData.Type === "Decrease" && Number(adjustData.Quantity) > currentStock) {
        return triggerNotification('warning', 'AlertTriggerErrors', `Cannot deduct more than current available stock (${currentStock} units)`);
    }

    const finalReason = adjustData.Notes ? `[${adjustData.Reason}] ${adjustData.Notes}` : adjustData.Reason;

    try {
      const res = await apiClient.post("/inventory/adjust", {
        BatchId: adjustData.BatchId,
        AdjustmentType: adjustData.Type,
        Quantity: Number(adjustData.Quantity),
        Reason: finalReason
      });

      if (res.success) {
        triggerNotification('success', 'AlertTriggerSale', res.message);
        setIsAdjustModalOpen(false);
        setAdjustData({ BatchId: 0, Type: "Increase", Quantity: "", Reason: "", Notes: "" });
        setAdjustBatchLabel("");
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
        triggerNotification('error', 'AlertTriggerErrors', res.message || "Failed to adjust stock");
      }
    } catch (err: any) {
      triggerNotification('error', 'AlertTriggerErrors', err.response?.data?.detail || "An error occurred");
    }
  };

  const openAdjustmentModal = (batch?: StockBatch) => {
    if (batch && batch.BatchId < 0) {
        return toast.error("Cannot adjust stock for a medicine that has never been purchased. Please add it via a Purchase Invoice first.");
    }
    if (batch) {
        setAdjustData({ BatchId: batch.BatchId, Type: "Increase", Quantity: "", Reason: "", Notes: "" });
        setAdjustBatchLabel(`${batch.MedicineName} (Batch: ${batch.BatchCode})`);
    } else {
        setAdjustData({ BatchId: 0, Type: "Increase", Quantity: "", Reason: "", Notes: "" });
        setAdjustBatchLabel("");
    }
    setIsAdjustModalOpen(true);
  };

  const openEditModal = (batch: StockBatch) => {
    setEditingBatch(batch);
    let expDateStr = "";
    if (batch.ExpiryDate) {
      try {
        const d = new Date(batch.ExpiryDate);
        if (!isNaN(d.getTime())) {
          expDateStr = d.toISOString().split("T")[0];
        }
      } catch {
        expDateStr = "";
      }
    }

    setEditFormData({
      BatchCode: batch.BatchCode === "—" ? "" : (batch.BatchCode || ""),
      ExpiryDate: expDateStr,
      PurchasePrice: String(batch.PurchasePrice ?? ""),
      SellingPrice: String(batch.SellingPrice ?? ""),
      CurrentStock: String(batch.CurrentStock ?? "0"),
      RackNumber: batch.RackNumber === "—" ? "" : (batch.RackNumber || ""),
      MinStock: String(batch.MinStock ?? ""),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditBatch = async () => {
    if (!editingBatch) return;

    if (!editFormData.BatchCode.trim() && editingBatch.BatchId > 0) {
      return triggerNotification('warning', 'AlertTriggerErrors', "Batch Code cannot be empty");
    }
    if (!editFormData.ExpiryDate && editingBatch.BatchId > 0) {
      return triggerNotification('warning', 'AlertTriggerErrors', "Expiry Date is required");
    }
    if (isNaN(Number(editFormData.PurchasePrice)) || Number(editFormData.PurchasePrice) < 0) {
      return triggerNotification('warning', 'AlertTriggerErrors', "Please enter a valid Purchase Price");
    }
    if (isNaN(Number(editFormData.SellingPrice)) || Number(editFormData.SellingPrice) < 0) {
      return triggerNotification('warning', 'AlertTriggerErrors', "Please enter a valid Selling Price");
    }
    if (isNaN(Number(editFormData.CurrentStock)) || Number(editFormData.CurrentStock) < 0) {
      return triggerNotification('warning', 'AlertTriggerErrors', "Please enter a valid Current Stock quantity");
    }

    setEditLoading(true);
    try {
      const res = await apiClient.put(`/inventory/stock/${editingBatch.BatchId}`, {
        BatchCode: editFormData.BatchCode.trim(),
        ExpiryDate: editFormData.ExpiryDate || null,
        PurchasePrice: Number(editFormData.PurchasePrice),
        SellingPrice: Number(editFormData.SellingPrice),
        CurrentStock: Number(editFormData.CurrentStock),
        RackNumber: editFormData.RackNumber.trim(),
        MinStock: editFormData.MinStock ? Number(editFormData.MinStock) : 0,
        MedicineId: editingBatch.MedicineId,
      });

      if (res.success) {
        toast.success(res.message || "Stock batch updated successfully");
        triggerNotification('success', 'AlertTriggerSale', res.message || "Stock batch updated successfully");
        setIsEditModalOpen(false);
        setEditingBatch(null);
        fetchData();
      } else {
        triggerNotification('error', 'AlertTriggerErrors', res.message || res.detail || "Failed to update stock batch");
      }
    } catch (err: any) {
      triggerNotification('error', 'AlertTriggerErrors', err.response?.data?.detail || err.message || "An error occurred");
    } finally {
      setEditLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return toast.error("No data to export");
    
    const rawHeaders = Object.keys(data[0]);
    
    const formattedHeaders = rawHeaders.map(h => {
      let res = h.replace(/([A-Z])/g, ' $1').trim();
      if (res === 'Source Id') res = 'Source ID';
      if (res === 'Batch Code') res = 'Batch No.';
      return res.toUpperCase();
    });

    const csvRows = data.map(row => {
      return rawHeaders.map(header => {
        let val = row[header];
        if (val === null || val === undefined) return "-";
        
        if (typeof val === 'number') {
           if (header.toLowerCase().includes('value') || header.toLowerCase().includes('price') || header.toLowerCase().includes('cost')) {
             return `${formatCurrency(val)}`;
           }
           return val.toString();
        }

        if (typeof val === 'string') {
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            const date = new Date(val.endsWith('Z') ? val : val + 'Z');
            return date.toLocaleString('en-GB', { 
              day: '2-digit', month: 'short', year: 'numeric', 
              hour: '2-digit', minute: '2-digit', hour12: true 
            }).toUpperCase();
          }
        }
        
        return String(val);
      });
    });

    const csvContent = [
      formattedHeaders.join(","),
      ...csvRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
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

  const exportToPDF = (data: any[], filename: string) => {
    if (!data || data.length === 0) return toast.error("No data to export");
    const doc = new jsPDF();
    const headers = Object.keys(data[0]);
    
    // Format headers slightly for display
    const formattedHeaders = headers.map(h => {
      let res = h.replace(/([A-Z])/g, ' $1').trim();
      if (res === 'Source Id') res = 'Source ID';
      if (res === 'Batch Code') res = 'Batch No.';
      return res.toUpperCase();
    });
    
    const tableRows = data.map(row => {
      return headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) return "-";

        if (typeof val === 'number') {
           if (header.toLowerCase().includes('value') || header.toLowerCase().includes('price') || header.toLowerCase().includes('cost')) {
             return `${formatCurrency(val)}`;
           }
           return val.toLocaleString();
        }

        if (typeof val === 'string') {
          // Check if it looks like an ISO date (e.g. 2026-08-26T20:05:50)
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            const date = new Date(val.endsWith('Z') ? val : val + 'Z');
            const d = date.toLocaleDateString('en-GB').replaceAll('/', '-');
            const t = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `${d} ${t}`;
          }
        }
        
        return val;
      });
    });

    const title = filename.replace(/_/g, ' ').toUpperCase();
    doc.setFontSize(16);
    doc.text(`Inventory Report - ${title}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB').replaceAll('/', '-')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`, 14, 28);

    autoTable(doc, {
      head: [formattedHeaders],
      body: tableRows,
      startY: 36,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // blue-500
      styles: { fontSize: 8 },
    });

    doc.save(`${filename}.pdf`);
  };

  // Navigate to Movement History tab and pre-fill batch filter
  const goToHistoryForBatch = (batchCode: string) => {
    setMovBatchFilter(batchCode);
    onTabChange("history");
  };

  // Open document preview modal for a movement reference
  const openPreview = async (mov: StockMovement) => {
    if (!mov.SourceId) return;
    const type = mov.MovementType;
    setPreviewDoc({ type, id: mov.SourceId, ref: mov.Reference });
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      let res: any = null;
      if (type === "Purchase") {
        res = await apiClient.get("/purchases");
        if (res.success && res.data) {
          const found = res.data.find((p: any) => p.PurchaseId === mov.SourceId);
          setPreviewData(found || null);
        }
      } else if (type === "POS Sale") {
        const sRes = await apiClient.get(`/sales/history?limit=500`);
        if (sRes.success && sRes.data) {
          const found = sRes.data.find((s: any) => s.SalesId === mov.SourceId);
          setPreviewData(found || null);
        }
      } else if (type === "Purchase Return") {
        const rRes = await apiClient.get("/purchase-returns");
        if (rRes.success && rRes.data) {
          const found = rRes.data.find((r: any) => r.ReturnId === mov.SourceId);
          setPreviewData(found || null);
        }
      } else {
        setPreviewData({ note: "No linked document available for this movement type." });
      }
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };


  const tabs = [
    { id: "current", label: "Current Stock" },
    { id: "adjustments", label: "Stock Adjustments" },
    { id: "history", label: "Stock Movement History" },
    { id: "expiry", label: "Expiry Tracking" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-background overflow-hidden print-container">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6 print-content">
        
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor stock levels, manage inventory movements, track medicine expiry, and maintain accurate stock records.
            </p>
          </div>
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

        {/* KPI Cards */}
        {activeTab !== "expiry" && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
            <KPICard title="Total Medicines"  value={summary.total_medicines}                                                              icon={<Pill           className="h-6 w-6" />} accent="blue"    />
            <KPICard title="Total Stock Qty"  value={summary.total_stock_quantity.toLocaleString()}                                       icon={<Package        className="h-6 w-6" />} accent="emerald" />
            <KPICard title="Inventory Value"  value={`${formatCurrency(summary.inventory_value)}`} icon={<CircleDollarSign className="h-6 w-6" />} accent="purple"  />
            <KPICard title="Low Stock"        value={summary.low_stock_items}                                                              icon={<AlertTriangle  className="h-6 w-6" />} accent="orange"  />
            <KPICard title="Expiring (90d)"   value={summary.expiring_medicines}                                                           icon={<CalendarDays   className="h-6 w-6" />} accent="amber"   />
            <KPICard title="Overstock"        value={summary.overstock_items}                                                              icon={<Package        className="h-6 w-6" />} accent="indigo"  />
            <KPICard title="Out of Stock"     value={summary.out_of_stock_medicines}                                                       icon={<Box            className="h-6 w-6" />} accent="rose"    />
          </div>
        )}

        {/* Expiry KPI Cards */}
        {activeTab === "expiry" && expiryKpi && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-card border-l-4 border-l-rose-500 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Already Expired</p>
                  <h3 className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">{expiryKpi.expired_count} batches</h3>
                </div>
                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Risk Value</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(expiryKpi.expired_value)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-card border-l-4 border-l-orange-500 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expiring in ≤ 30 Days</p>
                  <h3 className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">{expiryKpi.expiring_30d_count} batches</h3>
                </div>
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Risk Value</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(expiryKpi.expiring_30d_value)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-card border-l-4 border-l-amber-500 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expiring in ≤ 90 Days</p>
                  <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{expiryKpi.expiring_90d_count} batches</h3>
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Box className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Risk Value</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(expiryKpi.expiring_90d_value)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs & Actions */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-border mb-6">
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-secondary/50"
                )}
              >
                {tab.label}
              </button>
            ))}
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
                />
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                <select 
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[200px]"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All">Category: All</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select 
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[200px]"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                >
                  <option value="All">Company: All</option>
                  {uniqueCompanies.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
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
                    <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">Loading stock data...</td></tr>
                  ) : filteredStockList.length === 0 ? (
                    <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">No stock batches found.</td></tr>
                  ) : (
                    pagedStockList.map((item, idx) => {
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
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.PurchasePrice)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.SellingPrice)}</td>
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
                              <button
                                title="Edit batch and stock details"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                              >
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
            
            <div className="px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={stockPageSize}
                  onChange={e => { setStockPageSize(Number(e.target.value)); setStockCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Showing {filteredStockList.length === 0 ? 0 : (stockCurrentPage - 1) * stockPageSize + 1}–{Math.min(filteredStockList.length, stockCurrentPage * stockPageSize)} of {filteredStockList.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-8 px-3"
                    onClick={() => setStockCurrentPage(p => Math.max(1, p - 1))}
                    disabled={stockCurrentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline" size="sm" className="h-8 px-3"
                    onClick={() => setStockCurrentPage(p => Math.min(totalStockPages, p + 1))}
                    disabled={stockCurrentPage >= totalStockPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
            
          </div>
        )}
        
        {activeTab === "adjustments" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap justify-between items-center gap-3">
              <h3 className="font-semibold text-foreground">Stock Adjustment History</h3>
              <Button onClick={() => openAdjustmentModal()} className="bg-primary hover:bg-primary/90 text-white h-9">
                <Plus className="h-4 w-4 mr-2" /> New Adjustment
              </Button>
            </div>
            
            {/* Filter Bar */}
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap gap-3 items-center">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search medicine, batch..." 
                  className="h-9 pl-9 bg-background"
                  value={adjSearchQuery}
                  onChange={(e) => setAdjSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={adjTypeFilter}
                onChange={(e) => setAdjTypeFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="Additions (+)">Additions (+)</option>
                <option value="Deductions (-)">Deductions (-)</option>
              </select>
              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  className="h-9 w-[130px] bg-background text-sm"
                  value={adjStartDate}
                  onChange={(e) => setAdjStartDate(e.target.value)}
                  title="From Date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input 
                  type="date" 
                  className="h-9 w-[130px] bg-background text-sm"
                  value={adjEndDate}
                  onChange={(e) => setAdjEndDate(e.target.value)}
                  title="To Date"
                />
              </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Medicine Name</th>
                    <th className="px-4 py-3 font-semibold">Batch No.</th>
                    <th className="px-4 py-3 font-semibold text-center">Type</th>
                    <th className="px-4 py-3 font-semibold text-right">Previous Qty</th>
                    <th className="px-4 py-3 font-semibold text-right">Adjusted Qty</th>
                    <th className="px-4 py-3 font-semibold text-right">New Qty</th>
                    <th className="px-4 py-3 font-semibold">Reason / Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading history...</td></tr>
                  ) : pagedAdjHistory.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No stock adjustments found.</td></tr>
                  ) : (
                    pagedAdjHistory.map((adj, index) => (
                      <tr key={adj.AdjustmentId} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3 text-center font-medium text-muted-foreground">{(adjCurrentPage - 1) * adjPageSize + index + 1}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(adj.AdjustmentDate).toLocaleString('en-GB', { day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true }).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{adj.MedicineName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{adj.BatchCode}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            adj.AdjustmentType === "Increase" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                          )}>
                            {adj.AdjustmentType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {adj.PreviousQuantity !== null && adj.PreviousQuantity !== undefined ? adj.PreviousQuantity : "—"}
                        </td>
                        <td className={cn("px-4 py-3 text-right font-bold", adj.AdjustmentType === "Increase" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                          {adj.AdjustmentType === "Increase" ? "+" : "-"}{adj.Quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {adj.NewQuantity !== null && adj.NewQuantity !== undefined ? adj.NewQuantity : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate" title={adj.Reason}>{adj.Reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Showing {Math.min((adjCurrentPage - 1) * adjPageSize + 1, filteredAdjHistory.length)}–
                {Math.min(adjCurrentPage * adjPageSize, filteredAdjHistory.length)} of {filteredAdjHistory.length} records
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAdjCurrentPage(p => Math.max(1, p - 1))}
                  disabled={adjCurrentPage === 1}
                >
                  Previous
                </Button>
                <div className="px-2 text-sm font-medium">
                  Page {adjCurrentPage} of {totalAdjPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAdjCurrentPage(p => Math.min(totalAdjPages, p + 1))}
                  disabled={adjCurrentPage >= totalAdjPages}
                >
                  Next
                </Button>
              </div>
            </div>

          </div>
        )}

        {activeTab === "expiry" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">

            {/* Main Table Block */}
            <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm flex flex-col h-[600px]">
              
              {/* Filter Toolbar */}
              <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-lg">
                  {[
                    { label: "Already Expired", value: -1, color: "text-rose-600" },
                    { label: "30 Days", value: 30, color: "text-orange-600" },
                    { label: "60 Days", value: 60, color: "text-amber-600" },
                    { label: "90 Days", value: 90, color: "text-amber-600" },
                    { label: "180 Days", value: 180, color: "text-blue-600" },
                    { label: "All Expiring", value: 9999, color: "text-foreground" }
                  ].map(pill => (
                    <button
                      key={pill.value}
                      onClick={() => { setExpiryTimeframe(pill.value); setExpiryPage(1); }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                        expiryTimeframe === pill.value 
                          ? "bg-white dark:bg-card shadow-sm border border-border" 
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <span className={expiryTimeframe === pill.value ? pill.color : ""}>{pill.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-lg">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search medicine or batch..." 
                      className="h-9 pl-9"
                      value={expirySearch}
                      onChange={(e) => { setExpirySearch(e.target.value); setExpiryPage(1); }}
                    />
                  </div>
                  <select 
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={expirySupplierFilter}
                    onChange={(e) => { setExpirySupplierFilter(e.target.value); setExpiryPage(1); }}
                  >
                    <option value="All">All Suppliers</option>
                    {masterSuppliers.map(sup => (
                      <option key={sup.SupplierId} value={sup.Name}>{sup.Name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={() => exportToCSV(expiryItems, 'expiry_tracking')} variant="outline" size="sm" className="h-9">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" /> Export CSV
                  </Button>
                  <Button onClick={() => exportToPDF(expiryItems, 'expiry_tracking')} variant="outline" size="sm" className="h-9">
                    <FileText className="h-4 w-4 mr-2 text-rose-500" /> Export PDF
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-auto flex-1 custom-scrollbar" id="print-area">
                <table className="w-full text-left text-sm border-collapse min-w-[1100px]">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                    <tr className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                      <th className="px-4 py-3 font-semibold">Medicine Name</th>
                      <th className="px-4 py-3 font-semibold">Batch No.</th>
                      <th className="px-4 py-3 font-semibold">Supplier</th>
                      <th className="px-4 py-3 font-semibold text-center">Stock Remaining</th>
                      <th className="px-4 py-3 font-semibold text-center">Expiry Date</th>
                      <th className="px-4 py-3 font-semibold text-center">Days Remaining</th>
                      <th className="px-4 py-3 font-semibold text-right">Value at Risk (Rs.)</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading expiry data...</td></tr>
                    ) : expiryItems.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No expiring medicines found for this criteria.</td></tr>
                    ) : (
                      expiryItems.map((item, index) => (
                        <tr key={item.BatchId} className={cn(
                          "transition-colors hover:bg-secondary/10",
                          item.DaysToExpiry < 0 ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                        )}>
                          <td className="px-4 py-3 text-center font-medium text-muted-foreground">{(expiryPage - 1) * expiryPageSize + index + 1}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{item.MedicineName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.BatchCode}</td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]" title={item.SupplierName}>{item.SupplierName}</td>
                          <td className="px-4 py-3 text-center font-bold text-foreground">{item.CurrentStock}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {new Date(item.ExpiryDate).toLocaleDateString('en-GB', { day:'2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-bold",
                              item.DaysToExpiry < 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" :
                              item.DaysToExpiry < 30 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            )}>
                              {item.DaysToExpiry < 0 ? "Expired" : `${item.DaysToExpiry} Days`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {formatCurrency(item.ValueAtRisk)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.DaysToExpiry < 0 ? <AlertTriangle className="h-4 w-4 text-rose-500" /> :
                               item.DaysToExpiry < 30 ? <AlertTriangle className="h-4 w-4 text-orange-500" /> :
                               <CalendarDays className="h-4 w-4 text-amber-500" />}
                              <span className={cn(
                                "text-xs font-semibold uppercase",
                                item.DaysToExpiry < 0 ? "text-rose-600 dark:text-rose-400" :
                                item.DaysToExpiry < 30 ? "text-orange-600 dark:text-orange-400" :
                                "text-amber-600 dark:text-amber-400"
                              )}>
                                {item.DaysToExpiry < 0 ? "Expired" : item.DaysToExpiry < 30 ? "Critical" : "Warning"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2 text-xs"
                                title="Purchase Return"
                                onClick={() => router.push(`/dashboard/purchases?tab=returns&batch=${item.BatchCode}`)}
                              >
                                Return
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                                title="Scrap / Adjust"
                                onClick={() => {
                                  // Pre-fill adjustment modal
                                  setAdjustData({ 
                                    BatchId: item.BatchId, 
                                    Type: "Decrease", 
                                    Quantity: String(item.CurrentStock), 
                                    Reason: "Expired Scrap", 
                                    Notes: "" 
                                  });
                                  setAdjustBatchLabel(`${item.MedicineName} (Batch: ${item.BatchCode})`);
                                  setIsAdjustModalOpen(true);
                                }}
                              >
                                Scrap
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && expiryItems.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-slate-50/50 dark:bg-secondary/20 text-xs text-muted-foreground flex items-center justify-between">
                  <div>
                    Showing {Math.min((expiryPage - 1) * expiryPageSize + 1, expiryTotal)}–
                    {Math.min(expiryPage * expiryPageSize, expiryTotal)} of {expiryTotal} expiring batches
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-[11px]" 
                      disabled={expiryPage === 1}
                      onClick={() => setExpiryPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="px-2 font-medium">Page {expiryPage} of {Math.max(1, Math.ceil(expiryTotal / expiryPageSize))}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-[11px]" 
                      disabled={expiryPage >= Math.ceil(expiryTotal / expiryPageSize)}
                      onClick={() => setExpiryPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (() => {
          // Client-side multi-field search filter
          const filteredMovements = movSearchQuery
            ? movementList.filter(mov => {
                const q = movSearchQuery.toLowerCase();
                return (
                  mov.MedicineName.toLowerCase().includes(q) ||
                  mov.BatchCode.toLowerCase().includes(q) ||
                  (mov.Barcode || "").toLowerCase().includes(q) ||
                  mov.Reference.toLowerCase().includes(q)
                );
              })
            : movementList;

          const totalMovPages = Math.max(1, Math.ceil(filteredMovements.length / movPageSize));
          // If current page is out of bounds due to filtering, clamp it
          const safePage = Math.min(movCurrentPage, totalMovPages) || 1;
          const pagedMovements = filteredMovements.slice((safePage - 1) * movPageSize, safePage * movPageSize);

          // Movement type badge config
          const movTypeBadge = (type: string) => {
            switch (type) {
              case "Purchase":        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
              case "POS Sale":        return "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300";
              case "Purchase Return": return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
              case "Sale Return":     return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
              case "Stock Adjustment":return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
              default:               return "bg-secondary text-muted-foreground";
            }
          };

          return (
            <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[600px]">
              {/* Filter / Toolbar */}
              <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Multi-field search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search medicine, barcode, or batch..."
                      className="h-9 pl-9 pr-3 w-64 rounded-md border border-input bg-background text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={movSearchQuery}
                      onChange={(e) => { setMovSearchQuery(e.target.value); setMovCurrentPage(1); }}
                    />
                  </div>
                  {/* Batch code server-side filter */}
                  <input
                    type="text"
                    placeholder="Batch Code…"
                    className="h-9 px-3 w-36 rounded-md border border-input bg-background text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={movBatchFilter}
                    onChange={(e) => setMovBatchFilter(e.target.value)}
                  />
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={movTypeFilter}
                    onChange={(e) => setMovTypeFilter(e.target.value)}
                  >
                    <option value="">All Movements</option>
                    <option value="Purchase">Purchases</option>
                    <option value="POS Sale">POS Sales</option>
                    <option value="Purchase Return">Purchase Returns</option>
                    <option value="Sale Return">Sales Returns</option>
                    <option value="Stock Adjustment">Adjustments</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <Input type="date" className="h-9 w-36" value={movStartDate} onChange={(e) => setMovStartDate(e.target.value)} />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input type="date" className="h-9 w-36" value={movEndDate} onChange={(e) => setMovEndDate(e.target.value)} />
                  </div>
                  <Button onClick={fetchData} variant="outline" size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-white border-0">
                    <Search className="h-4 w-4 mr-1" /> Filter
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => exportToCSV(filteredMovements, 'stock_movements')} variant="outline" size="sm" className="h-9">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" /> CSV
                  </Button>
                  <Button onClick={() => exportToPDF(filteredMovements, 'stock_movements')} variant="outline" size="sm" className="h-9">
                    <FileText className="h-4 w-4 mr-2 text-rose-500" /> PDF
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-auto flex-1 custom-scrollbar" id="print-area">
                <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                    <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Date &amp; Time</th>
                      <th className="px-4 py-3 font-semibold">Medicine Name</th>
                      <th className="px-4 py-3 font-semibold">Batch No.</th>
                      <th className="px-4 py-3 font-semibold text-center">Movement Type</th>
                      <th className="px-4 py-3 font-semibold text-center">Qty Change</th>
                      <th className="px-4 py-3 font-semibold text-right">Balance Stock</th>
                      <th className="px-4 py-3 font-semibold">Reference No.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading movements...</td></tr>
                    ) : pagedMovements.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No stock movements found for the selected criteria.</td></tr>
                    ) : (
                      pagedMovements.map((mov, idx) => (
                        <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-4 py-3 text-center font-medium text-muted-foreground">{(safePage - 1) * movPageSize + idx + 1}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                            {new Date(mov.Date).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12: true }).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{mov.MedicineName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{mov.BatchCode}</td>
                          {/* Movement Type Badge */}
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
                              movTypeBadge(mov.MovementType)
                            )}>
                              {mov.MovementType}
                            </span>
                          </td>
                          {/* Qty Change */}
                          <td className={cn(
                            "px-4 py-3 text-center font-bold text-sm",
                            mov.QuantityChange > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                          )}>
                            {mov.QuantityChange > 0 ? "+" : ""}{mov.QuantityChange}
                          </td>
                          {/* Balance Stock */}
                          <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                            {mov.BalanceStock ?? "—"}
                          </td>
                          {/* Reference No. */}
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[220px] truncate" title={mov.Reference}>
                            {mov.SourceId && (mov.MovementType === "Purchase" || mov.MovementType === "POS Sale" || mov.MovementType === "Purchase Return") ? (
                                <button 
                                  onClick={() => openPreview(mov)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer focus:outline-none"
                                >
                                  {mov.Reference}
                                </button>
                            ) : (
                                <span>{mov.Reference}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Pagination */}
              {!loading && filteredMovements.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-slate-50/50 dark:bg-secondary/20 text-xs text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span>Showing {Math.min((safePage - 1) * movPageSize + 1, filteredMovements.length)}–{Math.min(safePage * movPageSize, filteredMovements.length)} of {filteredMovements.length} movements</span>
                    <div className="flex gap-4">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{filteredMovements.filter(m => m.QuantityChange > 0).reduce((s, m) => s + m.QuantityChange, 0)} in
                      </span>
                      <span className="text-rose-500 dark:text-rose-400 font-semibold">
                        {filteredMovements.filter(m => m.QuantityChange < 0).reduce((s, m) => s + m.QuantityChange, 0)} out
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-[11px]" 
                      disabled={safePage === 1}
                      onClick={() => setMovCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="px-2 font-medium">Page {safePage} of {totalMovPages}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-[11px]" 
                      disabled={safePage === totalMovPages}
                      onClick={() => setMovCurrentPage(p => Math.min(totalMovPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
                <Button onClick={() => exportToPDF(auditLogs, 'audit_logs')} variant="outline" size="sm" className="h-9">
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
                          {new Date(log.Timestamp).toLocaleString('en-GB', { day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true }).toUpperCase()}
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
                <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span> <span className="font-medium">{formatCurrency(selectedBatch.PurchasePrice)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Selling Price</span> <span className="font-medium">{formatCurrency(selectedBatch.SellingPrice)}</span></div>
              </div>
            </div>

            {/* Stock Details */}
            <div>
              <h5 className="text-sm font-semibold border-b border-border pb-2 mb-3">Stock Details</h5>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Current Stock</span> <span className="font-bold text-emerald-600 text-lg">{selectedBatch.CurrentStock}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Minimum Stock</span> <span className="font-medium">{selectedBatch.MinStock}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stock Value</span> <span className="font-bold text-foreground">{formatCurrency(selectedBatch.StockValue)}</span></div>
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
          
          <div className="p-4 border-t border-border grid grid-cols-3 gap-2 bg-slate-50/50 dark:bg-secondary/20">
            <Button onClick={() => openAdjustmentModal(selectedBatch)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-2">
              <Edit className="h-3.5 w-3.5 mr-1" /> Adjust Stock
            </Button>
            <Button
              variant="outline"
              className="w-full bg-white dark:bg-card text-amber-600 hover:text-amber-700 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs px-2"
              onClick={() => selectedBatch && openEditModal(selectedBatch)}
            >
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit Batch
            </Button>
            <Button
              variant="outline"
              className="w-full bg-white dark:bg-card text-xs px-2"
              onClick={() => selectedBatch && goToHistoryForBatch(selectedBatch.BatchCode)}
            >
              <History className="h-3.5 w-3.5 mr-1" /> View History
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
              {/* Batch Selection */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Select Batch <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input 
                    list="batch-options"
                    className="pl-9 h-10 font-medium bg-background"
                    placeholder="Search by medicine or batch..."
                    value={adjustBatchLabel}
                    onChange={(e) => {
                      setAdjustBatchLabel(e.target.value);
                      const matched = stockList.find(b => `${b.MedicineName} (Batch: ${b.BatchCode})` === e.target.value);
                      setAdjustData(prev => ({...prev, BatchId: matched ? matched.BatchId : 0}));
                    }}
                    disabled={!!(selectedBatch && selectedBatch.BatchId === adjustData.BatchId)}
                  />
                  <datalist id="batch-options">
                    {stockList.filter(b => b.BatchId > 0).map(batch => (
                      <option key={batch.BatchId} value={`${batch.MedicineName} (Batch: ${batch.BatchCode})`} />
                    ))}
                  </datalist>
                </div>
                {adjustData.BatchId > 0 && (
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1.5 ml-1">
                    Current Available Stock: {stockList.find(b => b.BatchId === adjustData.BatchId)?.CurrentStock || 0} units
                  </p>
                )}
              </div>

              {/* Type and Quantity */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Adjustment Type <span className="text-rose-500">*</span></label>
                  <div className="flex h-10 bg-slate-100 dark:bg-secondary/40 p-1 rounded-md border border-border">
                    <button 
                      onClick={() => setAdjustData({...adjustData, Type: "Increase"})}
                      className={cn(
                        "flex-1 text-sm font-bold rounded flex items-center justify-center transition-all",
                        adjustData.Type === "Increase" ? "bg-white dark:bg-card text-emerald-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      + Add Stock
                    </button>
                    <button 
                      onClick={() => setAdjustData({...adjustData, Type: "Decrease"})}
                      className={cn(
                        "flex-1 text-sm font-bold rounded flex items-center justify-center transition-all",
                        adjustData.Type === "Decrease" ? "bg-white dark:bg-card text-rose-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      - Deduct Stock
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Quantity <span className="text-rose-500">*</span></label>
                  <Input 
                    type="number" min="1"
                    placeholder="E.g. 5"
                    className="h-10 bg-background"
                    value={adjustData.Quantity}
                    onChange={(e) => setAdjustData({...adjustData, Quantity: e.target.value})}
                  />
                  {/* Dynamic Preview */}
                  {adjustData.BatchId > 0 && adjustData.Quantity && !isNaN(Number(adjustData.Quantity)) && (
                    <div className="text-[11px] font-medium bg-slate-50 dark:bg-secondary/30 border border-border p-2 rounded mt-2">
                      <span className="text-muted-foreground">Preview: </span> 
                      {(() => {
                        const current = stockList.find(b => b.BatchId === adjustData.BatchId)?.CurrentStock || 0;
                        const qty = Number(adjustData.Quantity) || 0;
                        const resulting = adjustData.Type === "Increase" ? current + qty : current - qty;
                        return (
                          <span>
                            {current} <span className="mx-1 text-muted-foreground">→</span> 
                            <span className={cn("font-bold text-xs", resulting < 0 ? "text-rose-500" : "text-emerald-600")}>
                              {resulting} units
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Justification & Notes */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Justification Reason <span className="text-rose-500">*</span></label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={adjustData.Reason}
                    onChange={(e) => setAdjustData({...adjustData, Reason: e.target.value})}
                  >
                    <option value="">-- Select Reason --</option>
                    <option value="Physical Count Mismatch">Physical Count Mismatch</option>
                    <option value="Damaged / Broken in Store">Damaged / Broken in Store</option>
                    <option value="Expired Scrap">Expired Scrap</option>
                    <option value="Customer Return without Invoice">Customer Return without Invoice</option>
                    <option value="Supplier Correction">Supplier Correction</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Notes / Remarks <span className="text-muted-foreground font-normal">(Optional)</span></label>
                  <Input 
                    placeholder="Additional context for this adjustment..."
                    className="h-10 bg-background"
                    value={adjustData.Notes}
                    onChange={(e) => setAdjustData({...adjustData, Notes: e.target.value})}
                  />
                </div>

                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
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

      {/* --- EDIT STOCK BATCH MODAL --- */}
      {isEditModalOpen && editingBatch && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-secondary/20">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Edit className="h-4 w-4" />
                  </div>
                  Edit Stock Batch
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update batch code, expiry date, prices, shelf location, and stock level
                </p>
              </div>
              <button
                onClick={() => { setIsEditModalOpen(false); setEditingBatch(null); }}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Medicine Context Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-secondary/30 rounded-xl border border-border/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-foreground">{editingBatch.MedicineName}</span>
                  <span className="font-mono text-xs px-2 py-0.5 bg-background rounded border border-border text-muted-foreground">
                    {editingBatch.CodeBarcode}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Category: <strong className="text-foreground">{editingBatch.CategoryName}</strong></span>
                  <span>•</span>
                  <span>Company: <strong className="text-foreground">{editingBatch.CompanyName}</strong></span>
                  {editingBatch.SupplierName && editingBatch.SupplierName !== "Unknown" && (
                    <>
                      <span>•</span>
                      <span>Supplier: <strong className="text-foreground">{editingBatch.SupplierName}</strong></span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Batch Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Batch Code <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. BATCH-001"
                    className="h-9 font-mono text-sm bg-background"
                    value={editFormData.BatchCode}
                    onChange={(e) => setEditFormData({ ...editFormData, BatchCode: e.target.value })}
                  />
                </div>

                {/* Expiry Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Expiry Date <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-background"
                    value={editFormData.ExpiryDate}
                    onChange={(e) => setEditFormData({ ...editFormData, ExpiryDate: e.target.value })}
                  />
                </div>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Purchase Price (Cost) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-9 text-sm bg-background"
                    value={editFormData.PurchasePrice}
                    onChange={(e) => setEditFormData({ ...editFormData, PurchasePrice: e.target.value })}
                  />
                </div>

                {/* Selling Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Selling Price (Retail) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-9 text-sm bg-background"
                    value={editFormData.SellingPrice}
                    onChange={(e) => setEditFormData({ ...editFormData, SellingPrice: e.target.value })}
                  />
                </div>

                {/* Current Stock */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Current Stock (Quantity) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    className="h-9 text-sm bg-background font-bold"
                    value={editFormData.CurrentStock}
                    onChange={(e) => setEditFormData({ ...editFormData, CurrentStock: e.target.value })}
                  />
                  {editingBatch && Number(editFormData.CurrentStock) !== editingBatch.CurrentStock && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Stock will adjust from {editingBatch.CurrentStock} to {editFormData.CurrentStock || 0}
                    </p>
                  )}
                </div>

                {/* Min Stock (Reorder Level) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Min Stock (Reorder Alert)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 10"
                    className="h-9 text-sm bg-background"
                    value={editFormData.MinStock}
                    onChange={(e) => setEditFormData({ ...editFormData, MinStock: e.target.value })}
                  />
                </div>

                {/* Rack Number / Shelf */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-foreground">
                    Rack / Shelf Number
                  </label>
                  <Input
                    placeholder="e.g. Rack A-12 / Shelf 3"
                    className="h-9 text-sm bg-background"
                    value={editFormData.RackNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, RackNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={editLoading}
                onClick={() => { setIsEditModalOpen(false); setEditingBatch(null); }}
              >
                Cancel
              </Button>
              <Button
                disabled={editLoading}
                onClick={handleSaveEditBatch}
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                {editLoading ? "Saving Changes..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card w-full max-w-3xl rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  {previewDoc.type} Document
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Reference: <span className="font-mono text-foreground font-semibold">{previewDoc.ref}</span></p>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-auto custom-scrollbar">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCcw className="h-8 w-8 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Loading document details...</p>
                </div>
              ) : !previewData ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-10 w-10 text-rose-400 mb-4" />
                  <p className="text-base font-semibold text-foreground">Document Not Found</p>
                  <p className="text-sm text-muted-foreground mt-1">This document may have been deleted or is unavailable.</p>
                </div>
              ) : previewData.note ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-slate-400 mb-4" />
                  <p className="text-sm text-muted-foreground">{previewData.note}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Meta Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-secondary/30 rounded-lg border border-border">
                    {previewDoc.type === "Purchase" && (
                      <>
                        <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-semibold text-sm">{previewData.SupplierName || "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Date</p><p className="font-semibold text-sm">{new Date(previewData.PurchaseDate).toLocaleDateString()}</p></div>
                        <div><p className="text-xs text-muted-foreground">Payment Status</p><p className="font-semibold text-sm">{previewData.PaymentStatus}</p></div>
                        <div><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-semibold text-sm text-primary">{formatCurrency(previewData?.GrandTotal)}</p></div>
                      </>
                    )}
                    {previewDoc.type === "POS Sale" && (
                      <>
                        <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold text-sm">{previewData.CustomerName || "Walk-in"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Date</p><p className="font-semibold text-sm">{new Date(previewData.TransactionDate).toLocaleDateString()}</p></div>
                        <div><p className="text-xs text-muted-foreground">Payment Mode</p><p className="font-semibold text-sm">{previewData.PaymentMethod}</p></div>
                        <div><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-semibold text-sm text-primary">{formatCurrency(previewData?.GrandTotal)}</p></div>
                      </>
                    )}
                    {previewDoc.type === "Purchase Return" && (
                      <>
                        <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-semibold text-sm">{previewData.SupplierName || "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Date</p><p className="font-semibold text-sm">{new Date(previewData.ReturnDate).toLocaleDateString()}</p></div>
                        <div><p className="text-xs text-muted-foreground">Original Invoice</p><p className="font-semibold text-sm">{previewData.OriginalInvoiceNumber || "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Refund Total</p><p className="font-semibold text-sm text-rose-500">{formatCurrency(previewData.TotalRefundAmount)}</p></div>
                      </>
                    )}
                  </div>

                  {/* Items Table */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Box className="h-4 w-4 text-muted-foreground" /> Line Items
                    </h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/50 text-muted-foreground text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold">Medicine</th>
                            <th className="px-4 py-2.5 font-semibold">Batch</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Unit Price</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewData.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-secondary/20">
                              <td className="px-4 py-2.5 font-medium">{item.MedicineName || "—"}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{item.BatchCode || "—"}</td>
                              <td className="px-4 py-2.5 text-right font-semibold">{item.Quantity || item.ReturnQuantity || 0}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency((item.SellingPrice || item.CostPrice || item.UnitRefundPrice || 0))}</td>
                              <td className="px-4 py-2.5 text-right font-medium">{formatCurrency((item.LineTotal || item.TotalRefund || 0))}</td>
                            </tr>
                          ))}
                          {!previewData.items || previewData.items.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">No line items found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {previewData.Notes && previewData.Notes.trim() && (
                    <div className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-md border border-border">
                      <span className="font-semibold text-foreground">Notes:</span> {previewData.Notes}
                    </div>
                  )}
                  {previewData.ReturnReason && previewData.ReturnReason.trim() && (
                    <div className="text-sm text-muted-foreground bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-md border border-border">
                      <span className="font-semibold text-foreground">Reason:</span> {previewData.ReturnReason}
                    </div>
                  )}
                </div>
              )}
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
