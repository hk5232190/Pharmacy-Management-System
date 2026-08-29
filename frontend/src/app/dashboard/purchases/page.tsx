"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, DollarSign, Undo2, Users, FileText, 
  Search, Plus, Save, Printer, Eye, X, Trash2, Calendar,
  ArrowDownToLine, CreditCard, ChevronLeft, ChevronRight,
  RefreshCcw,
  Check
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";

// --- Types ---
interface Supplier {
  SupplierId: number;
  Name: string;
}

interface Medicine {
  MedicineId: number;
  BrandName: string;
  GenericName: string;
  DefaultCostPrice: number;
  DefaultSellingPrice: number;
  Barcode: string;
}

interface PurchaseItem {
  id: string; // unique local ID for grid
  MedicineId: number;
  MedicineName: string;
  BatchCode: string;
  ManufacturingDate: string;
  ExpiryDate: string;
  CostPrice: number;
  SellingPrice: number;
  Quantity: number;
  FreeQty: number;
  Discount: number;
  TaxPercentage: number;
  LineTotal: number;
}

interface HistoryItem {
  PurchaseItemId: number;
  MedicineId: number;
  MedicineName: string;
  BatchCode: string;
  Quantity: number;
  FreeQty: number;
  CostPrice: number;
  SellingPrice: number;
  LineTotal: number;
  ExpiryDate: string;
}

interface PurchaseHistory {
  PurchaseId: number;
  SupplierId: number;
  InvoiceNumber: string;
  SupplierName: string;
  PurchaseDate: string;
  GrandTotal: number;
  PaidAmount: number;
  PaymentStatus: string;
  items: HistoryItem[];
}

export default function PurchaseManagementPageWrapper() {
  const { formatCurrency, currencySymbol } = useSystemPreferences();
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

  const [activeTab, setActiveTab] = useState<"invoice" | "history" | "returns">("invoice");

  return <PurchaseManagementPage key={refreshKey} refreshState={refreshState} onRefresh={handleRefresh} activeTab={activeTab} onTabChange={setActiveTab} />;
}

function PurchaseManagementPage({ onRefresh, refreshState, activeTab, onTabChange }: { onRefresh: () => void, refreshState: "idle" | "loading" | "done", activeTab: "invoice" | "history" | "returns", onTabChange: (tab: "invoice" | "history" | "returns") => void }) {
  const { formatNumber, formatCurrency, currencySymbol } = useSystemPreferences();
  // --- Tabs ---
  // (activeTab is now managed by the wrapper so it survives a refresh reset)

  // --- States for Invoice Tab ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  
  // Invoice Info
  const [invoiceNo, setInvoiceNo] = useState(`PI-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [purchaseDate, setPurchaseDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [supplierId, setSupplierId] = useState<number>(0);
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [notes, setNotes] = useState("");
  
  // Grid
  const [items, setItems] = useState<PurchaseItem[]>([]);
  
  // Totals
  const [subTotal, setSubTotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  
  // --- States for History Tab ---
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseHistory | null>(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState<number>(0);
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);

  // --- States for Returns Tab ---
  const [returnsHistory, setReturnsHistory] = useState<any[]>([]);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<PurchaseHistory | null>(null);
  const [returnItems, setReturnItems] = useState<{ PurchaseItemId: number; MedicineId: number; MedicineName: string; BatchCode: string; OriginalQty: number; ReturnQty: number; CostPrice: number; RefundAmount: number; ReturnReason: string }[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [settlementType, setSettlementType] = useState("Adjust in Supplier Balance");
  const [returnInvNo, setReturnInvNo] = useState(`DN-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [returnsCurrentPage, setReturnsCurrentPage] = useState(1);
  const [returnsPageSize, setReturnsPageSize] = useState(10);

  const fmt = (n: number) => formatNumber ? formatNumber(n) : n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Effects ---
  useEffect(() => {
    fetchSummary();
    fetchSuppliers();
    fetchHistory();
    fetchReturns();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const timer = setTimeout(() => searchMedicines(searchQuery), 300);
      return () => clearTimeout(timer);
    } else {
      setMedicines([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    setHistoryCurrentPage(1);
  }, [historySearchQuery, filterSupplierId, filterFromDate, filterToDate]);

  useEffect(() => {
    calculateTotals();
  }, [items]);

  useEffect(() => {
    if (grandTotal > 0) {
      const balance = Math.max(0, grandTotal - paidAmount);
      if (balance <= 0) setPaymentStatus("Paid");
      else if (paidAmount > 0) setPaymentStatus("Partial");
      else setPaymentStatus("Unpaid");
    }
  }, [paidAmount, grandTotal]);

  // --- API Calls ---
  const fetchSummary = async () => {
    try {
      const data = await apiClient.get("/purchases/summary");
      if (data.success) {
        setSummaryData(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch purchase summary");
    }
  };
  const fetchSuppliers = async () => {
    try {
      const data = await apiClient.get("/suppliers");
      if (data.success) {
        setSuppliers(data.data.filter((s: any) => s.IsActive));
      }
    } catch (e) {
      console.error("Failed to fetch suppliers");
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await apiClient.get("/purchases");
      if (data.success) {
        setPurchaseHistory(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch history");
    }
  };

  const fetchReturns = async () => {
    try {
      const data = await apiClient.get("/purchase-returns");
      if (data.success) {
        setReturnsHistory(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch returns history");
    }
  };

  const searchMedicines = async (query: string) => {
    try {
      const data = await apiClient.get(`/medicines`, { params: { search: query } });
      if (data.success) {
        setMedicines(data.data);
      }
    } catch (e) {
      console.error("Failed to search medicines");
    }
  };

  // --- Invoice Tab Actions ---
  const addMedicineToGrid = (med: Medicine) => {
    const newItem: PurchaseItem = {
      id: Math.random().toString(36).substr(2, 9),
      MedicineId: med.MedicineId,
      MedicineName: med.BrandName,
      BatchCode: "",
      ManufacturingDate: "",
      ExpiryDate: "",
      CostPrice: med.DefaultCostPrice || 0,
      SellingPrice: med.DefaultSellingPrice || 0,
      Quantity: 1,
      FreeQty: 0,
      Discount: 0,
      TaxPercentage: 0,
      LineTotal: med.DefaultCostPrice || 0
    };
    setItems([...items, newItem]);
    setSearchQuery("");
    setMedicines([]);
  };

  const handleAddByBarcode = async () => {
    if (!barcodeQuery.trim()) return toast.error("Please enter a barcode");
    try {
      const data = await apiClient.get(`/medicines`, { params: { search: barcodeQuery } });
      if (data.success && data.data && data.data.length > 0) {
        const exactMatch = data.data.find((m: Medicine) => m.Barcode === barcodeQuery);
        const medToAdd = exactMatch || data.data[0];
        addMedicineToGrid(medToAdd);
        setBarcodeQuery("");
        toast.success(`Added ${medToAdd.BrandName}`);
      } else {
        toast.error("No medicine found with this barcode");
      }
    } catch (e) {
      toast.error("Failed to search by barcode");
    }
  };

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'Discount') {
          updated.Discount = Math.min(100, Math.max(0, Number(value) || 0));
        }
        if (['CostPrice', 'Quantity', 'Discount', 'TaxPercentage'].includes(field)) {
          const qty = Number(updated.Quantity) || 0;
          const cost = Number(updated.CostPrice) || 0;
          const discountPct = Number(updated.Discount) || 0;
          const taxPct = Number(updated.TaxPercentage) || 0;
          
          const base = (qty * cost);
          const discAmt = base * (discountPct / 100);
          const taxAmt = (base - discAmt) * (taxPct / 100);
          updated.LineTotal = (base - discAmt) + taxAmt;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    let sub = 0, disc = 0, tax = 0, grand = 0;
    
    items.forEach(item => {
      const qty = Number(item.Quantity) || 0;
      const cost = Number(item.CostPrice) || 0;
      const discountPct = Math.min(100, Math.max(0, Number(item.Discount) || 0));
      const taxPct = Number(item.TaxPercentage) || 0;
      
      const basePrice = qty * cost;
      const discAmt = basePrice * (discountPct / 100);
      const taxAmt = (basePrice - discAmt) * (taxPct / 100);
      
      sub += basePrice;
      disc += discAmt;
      tax += taxAmt;
      grand += (basePrice - discAmt + taxAmt);
    });
    
    setSubTotal(sub);
    setTotalDiscount(disc);
    setTotalTax(tax);
    setGrandTotal(grand);
    
    if (paymentStatus === "Paid") {
      setPaidAmount(grand);
    } else if (paymentStatus === "Unpaid") {
      setPaidAmount(0);
    }
  };

  const handleSave = async (printAfterSave: boolean = false) => {
    if (!supplierId || supplierId === 0) return toast.error("Please select a supplier");
    if (items.length === 0) return toast.error("Please add at least one medicine to the invoice");
    
    for (const item of items) {
      if (!item.BatchCode || !item.BatchCode.trim()) return toast.error(`Missing Batch Code for ${item.MedicineName}`);
      if (!item.ExpiryDate) return toast.error(`Missing Expiry Date for ${item.MedicineName}`);
      
      if (Number(item.CostPrice) > Number(item.SellingPrice)) {
        return toast.error(`Cost Price cannot exceed Sale Price for ${item.MedicineName} (SRS Rule)`);
      }
      
      const expDate = new Date(item.ExpiryDate);
      if (isNaN(expDate.getTime())) return toast.error(`Invalid Expiry Date for ${item.MedicineName}`);

      const minDate = new Date();
      minDate.setDate(minDate.getDate() + 30);
      if (expDate <= minDate) {
        return toast.error(`Expiry Date for ${item.MedicineName} must be strictly > 30 days from today (SRS Rule)`);
      }
    }

    const payload = {
      SupplierId: supplierId,
      InvoiceNumber: invoiceNo,
      SupplierInvNo: supplierInvNo || null,
      PaymentStatus: paymentStatus,
      PaymentMethod: paymentMethod,
      Notes: notes || null,
      SubTotal: subTotal,
      TotalDiscount: totalDiscount,
      TotalTax: totalTax,
      GrandTotal: grandTotal,
      PaidAmount: paidAmount,
      RemainingBalance: grandTotal - paidAmount,
      PurchaseDate: new Date(purchaseDate).toISOString(),
      items: items.map(i => ({
        MedicineId: i.MedicineId,
        BatchCode: i.BatchCode,
        Quantity: Number(i.Quantity),
        FreeQty: Number(i.FreeQty),
        CostPrice: Number(i.CostPrice),
        SellingPrice: Number(i.SellingPrice),
        Discount: Number(i.Discount),
        TaxPercentage: Number(i.TaxPercentage),
        LineTotal: Number(i.LineTotal),
        ManufacturingDate: i.ManufacturingDate || null,
        ExpiryDate: i.ExpiryDate
      }))
    };

    try {
      const data = await apiClient.post("/purchases", payload);
      if (data.success) {
        toast.success(data.message);
        
        if (printAfterSave) {
          const printedInv = {
            PurchaseId: data.data?.PurchaseId || Math.random(),
            InvoiceNumber: invoiceNo,
            SupplierName: suppliers.find(s => s.SupplierId === supplierId)?.Name || "Unknown Supplier",
            PurchaseDate: purchaseDate,
            GrandTotal: grandTotal,
            PaidAmount: paidAmount,
            PaymentStatus: paymentStatus,
            items: payload.items.map((i: any) => ({
              PurchaseItemId: Math.random(),
              MedicineId: i.MedicineId,
              MedicineName: items.find(med => med.MedicineId === i.MedicineId)?.MedicineName || "Unknown",
              BatchCode: i.BatchCode,
              Quantity: i.Quantity,
              FreeQty: i.FreeQty,
              CostPrice: i.CostPrice,
              SellingPrice: i.SellingPrice,
              LineTotal: i.LineTotal,
              ExpiryDate: i.ExpiryDate
            }))
          };
          setViewingInvoice(printedInv as any);
          setTimeout(() => window.print(), 300);
        }

        setItems([]);
        setSupplierInvNo("");
        setInvoiceNo(`PI-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`);
        fetchHistory();
      } else {
        toast.error(data.error || "Failed to save purchase");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  // --- Returns Tab Actions ---
  const handleReturnInvoiceSelect = (invId: string) => {
    if (!invId) {
      setSelectedReturnInvoice(null);
      setReturnItems([]);
      return;
    }
    const inv = purchaseHistory.find(i => i.PurchaseId.toString() === invId);
    if (inv) {
      setSelectedReturnInvoice(inv);
      setReturnItems(inv.items.map(i => ({
        PurchaseItemId: i.PurchaseItemId,
        MedicineId: i.MedicineId,
        MedicineName: i.MedicineName,
        BatchCode: i.BatchCode,
        OriginalQty: i.Quantity + i.FreeQty,
        ReturnQty: 0,
        CostPrice: i.CostPrice,
        RefundAmount: 0,
        ReturnReason: 'Expired'
      })));
    }
  };

  const updateReturnItem = (itemId: number, field: string, value: any) => {
    setReturnItems(returnItems.map(item => {
      if (item.PurchaseItemId === itemId) {
        const updated = { ...item, [field]: value };
        if (field === 'ReturnQty') {
           const qtyNum = Number(value);
           updated.ReturnQty = Math.min(Math.max(0, qtyNum), item.OriginalQty);
           updated.RefundAmount = updated.ReturnQty * item.CostPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSaveReturn = async () => {
    if (!selectedReturnInvoice) return toast.error("Select an invoice to return items from.");
    const itemsToReturn = returnItems.filter(i => i.ReturnQty > 0);
    if (itemsToReturn.length === 0) return toast.error("No items selected to return.");

    const totalRefund = itemsToReturn.reduce((sum, item) => sum + item.RefundAmount, 0);

    const payload = {
      PurchaseId: selectedReturnInvoice.PurchaseId,
      SupplierId: selectedReturnInvoice.SupplierId,
      ReturnInvoiceNumber: returnInvNo,
      TotalRefundAmount: totalRefund,
      Reason: returnReason || null,
      SettlementType: settlementType,
      items: itemsToReturn.map(i => ({
        MedicineId: i.MedicineId,
        BatchCode: i.BatchCode,
        ReturnQuantity: i.ReturnQty,
        RefundAmount: i.RefundAmount,
        ReturnReason: i.ReturnReason
      }))
    };

    try {
      const data = await apiClient.post("/purchase-returns", payload);
      if (data.success) {
        toast.success(data.message);
        setSelectedReturnInvoice(null);
        setReturnItems([]);
        setReturnReason("");
        setReturnInvNo(`DN-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`);
        fetchReturns();
      } else {
        toast.error(data.error || "Failed to process return");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const totalRefundDue = returnItems.reduce((sum, item) => sum + item.RefundAmount, 0);

  // Data to print or preview
  let printData: any = null;
  if (viewingInvoice) {
    if ((viewingInvoice as any).ReturnInvoiceNumber) { // It's a Debit Note
      const rn = viewingInvoice as any;
      printData = {
        IsReturn: true,
        InvoiceNumber: rn.ReturnInvoiceNumber,
        SupplierName: rn.SupplierName || "Unknown Supplier",
        PurchaseDate: rn.ReturnDate,
        GrandTotal: rn.TotalRefundAmount,
        PaidAmount: 0,
        SettlementType: rn.SettlementType,
        items: rn.items.map((i: any) => ({ ...i, PurchaseItemId: i.ReturnItemId, LineTotal: i.RefundAmount, CostPrice: (i.RefundAmount/i.ReturnQuantity) || 0, Quantity: i.ReturnQuantity }))
      };
    } else {
      printData = { ...viewingInvoice, IsReturn: false };
    }
  } else if (showDraftPreview) {
    printData = {
      IsReturn: false,
      InvoiceNumber: invoiceNo,
      SupplierName: suppliers.find(s => s.SupplierId === supplierId)?.Name || "Unknown Supplier",
      PurchaseDate: purchaseDate,
      GrandTotal: grandTotal,
      PaidAmount: paidAmount,
      items: items.map(i => ({ ...i, PurchaseItemId: i.id }))
    };
  }

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, nextId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextElement = document.getElementById(nextId);
      if (nextElement) {
        nextElement.focus();
        if (nextElement instanceof HTMLInputElement) {
           nextElement.select();
        }
      }
    }
  };

  const filteredPurchaseHistory = purchaseHistory.filter(inv => {
    let match = true;
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      match = match && (inv.InvoiceNumber.toLowerCase().includes(q) || (inv.SupplierName && inv.SupplierName.toLowerCase().includes(q)) || ((inv as any).SupplierInvNo && String((inv as any).SupplierInvNo).toLowerCase().includes(q)));
    }
    if (filterSupplierId > 0) {
      match = match && (inv.SupplierId === filterSupplierId);
    }
    if (filterFromDate) {
      match = match && (new Date(inv.PurchaseDate) >= new Date(filterFromDate));
    }
    if (filterToDate) {
      // Set to end of day for proper comparison
      const toDate = new Date(filterToDate);
      toDate.setHours(23, 59, 59, 999);
      match = match && (new Date(inv.PurchaseDate) <= toDate);
    }
    return match;
  });

  const totalHistoryPages = Math.max(1, Math.ceil(filteredPurchaseHistory.length / historyPageSize));
  const paginatedHistory = filteredPurchaseHistory.slice(
    (historyCurrentPage - 1) * historyPageSize,
    historyCurrentPage * historyPageSize
  );

  // --- Render ---
  return (
    <>
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-background overflow-hidden relative print:hidden">
      
      {/* Header & Stats Container */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6">
        
        {/* Title */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Purchase Management</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Purchase medicines, manage supplier invoices, receive stock, process purchase returns, and maintain complete purchase records.
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

        {/* Stats Cards — only visible on History tab */}
        {activeTab === "history" && (() => {
          const todayTotal = purchaseHistory
            .filter(p => new Date(p.PurchaseDate).toDateString() === new Date().toDateString())
            .reduce((acc, curr) => acc + curr.GrandTotal, 0);
          const allTimeTotal = purchaseHistory.reduce((acc, curr) => acc + curr.GrandTotal, 0);
          const processedReturns = summaryData?.total_returns_count ?? returnsHistory.length;
          const balanceDue = summaryData?.total_balance_due ?? purchaseHistory.reduce((acc, curr) => acc + Math.max(0, curr.GrandTotal - curr.PaidAmount), 0);
          const totalInvoices = summaryData?.total_invoices_count ?? purchaseHistory.length;

          const cards = [
            { title: "Today's Purchases",    value: formatCurrency(Math.max(0, todayTotal)), icon: ShoppingCart, accent: "blue" },
            { title: "Total Purchase Amount", value: formatCurrency(Math.max(0, allTimeTotal)), icon: DollarSign,  accent: "emerald" },
            { title: "Processed Returns",     value: String(processedReturns),             icon: Undo2,        accent: "orange" },
            { title: "Total Balance Due",     value: formatCurrency(balanceDue),              icon: CreditCard,   accent: "rose" },
            { title: "Total Invoices",        value: String(totalInvoices),                icon: FileText,     accent: "teal" },
          ];

          const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
            blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
            emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            orange:  { border: "border-l-orange-500",  iconCls: "text-orange-500",  text: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-900/20" },
            rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
            teal:    { border: "border-l-teal-500",    iconCls: "text-teal-500",    text: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-50 dark:bg-teal-900/20" },
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              {cards.map(({ title, value, icon: Icon, accent }) => {
                const a = accentMap[accent];
                return (
                  <div
                    key={title}
                    className={cn(
                      "relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md",
                      a.border
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.bg)}>
                      <Icon size={22} className={a.iconCls} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
                      <p className={cn("text-2xl font-extrabold leading-none tabular-nums truncate", a.text)}>{value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}


        {/* Tabs */}
        <div className="flex gap-2 border-b border-border mb-6">
          <button              onClick={() => onTabChange("invoice")}
            className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors", activeTab === "invoice" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
          >
            Purchase Invoice
          </button>
          <button              onClick={() => onTabChange("history")}
            className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors", activeTab === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
          >
            Purchase History
          </button>
          <button              onClick={() => onTabChange("returns")}
            className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors", activeTab === "returns" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
          >
            Purchase Returns
          </button>
        </div>

        {/* --- INVOICE TAB --- */}
        {activeTab === "invoice" && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* === ROW 1: Purchase Information + Invoice Summary === */}
            <div className="flex flex-col xl:flex-row gap-5 items-stretch">

              {/* Purchase Information */}
              <div className="flex-1 bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-secondary/20">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                    Purchase Information
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Invoice No.</label>
                    <Input value={invoiceNo} disabled className="h-9 bg-slate-50 dark:bg-secondary/50 font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Purchase Date <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} className="h-9 pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Supplier <span className="text-rose-500">*</span></label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={supplierId}
                      onChange={e=>setSupplierId(Number(e.target.value))}
                    >
                      <option value={0} disabled>Select Supplier</option>
                      {suppliers.map(s => <option key={s.SupplierId} value={s.SupplierId}>{s.Name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Supplier Inv. No.</label>
                    <Input value={supplierInvNo} onChange={e=>setSupplierInvNo(e.target.value)} placeholder="e.g. INV-78956" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Payment Status</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={paymentStatus}
                      onChange={e=>{
                        const val = e.target.value;
                        setPaymentStatus(val);
                        if (val === "Paid") setPaidAmount(grandTotal);
                        else if (val === "Unpaid") setPaidAmount(0);
                      }}
                    >
                      <option value="Paid">Paid</option>
                      <option value="Partial">Partial</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Payment Method</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={paymentMethod}
                      onChange={e=>setPaymentMethod(e.target.value)}
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground">Notes (Optional)</label>
                    <Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enter any notes for this purchase..." className="h-9" />
                  </div>
                </div>
              </div>

              {/* Invoice Summary Card */}
              <div className="w-full xl:w-[380px] shrink-0 bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-700 shadow-sm text-white flex flex-col">
                <div className="px-5 py-3.5 border-b border-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-white">Invoice Summary</h3>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex justify-between items-center text-sm text-slate-300">
                    <span>Subtotal</span>
                    <span className="font-medium text-white">Rs. {formatNumber(Number(subTotal || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-rose-400">
                    <span>Discount</span>
                    <span className="font-medium">- Rs. {formatNumber(Number(totalDiscount || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-emerald-400">
                    <span>Tax</span>
                    <span className="font-medium">+ Rs. {formatNumber(Number(totalTax || 0))}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
                    <span className="font-bold text-sm text-white">Grand Total</span>
                    <span className="font-bold text-xl text-white">Rs. {formatNumber(Number(grandTotal || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-emerald-400">
                    <span>Paid</span>
                    <div className="w-24 text-right">
                        <Input
                          type="number" min="0" step="0.01" max={grandTotal}
                          value={paidAmount}
                          onChange={e => setPaidAmount(Number(e.target.value))}
                          className="h-7 text-xs px-2 text-right text-emerald-400 font-semibold bg-slate-800 border-slate-600"
                        />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-rose-400">
                    <span>Balance Due</span>
                    <span className="font-medium">Rs. {formatNumber(Number(Math.max(0, grandTotal - paidAmount) || 0))}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-auto pt-3 border-t border-slate-700 grid grid-cols-2 gap-2">
                    <Button onClick={() => handleSave(false)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 text-xs col-span-1">
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save
                    </Button>
                    <Button onClick={() => handleSave(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 text-xs col-span-1">
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Save & Print
                    </Button>
                    <Button onClick={() => setShowDraftPreview(true)} variant="outline" className="h-9 text-xs border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent col-span-1">
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                    </Button>
                    <Button variant="outline" className="h-9 text-xs border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent col-span-1" onClick={() => setItems([])}>
                      <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Clear
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* === ROW 2: Add Medicines Grid (Full Width) === */}
            <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[450px]">
              <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-col sm:flex-row justify-between items-center gap-3">
                <h3 className="font-semibold text-sm text-foreground whitespace-nowrap">2. Add Medicines</h3>
                
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search medicine by name..." 
                      className="h-9 pl-9 text-sm"
                      value={searchQuery}
                      onChange={e=>setSearchQuery(e.target.value)}
                    />
                    {medicines.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar">
                        {medicines.map(med => (
                          <div 
                            key={med.MedicineId} 
                            className="px-3 py-2 hover:bg-secondary cursor-pointer border-b border-border last:border-0 text-sm flex justify-between"
                            onClick={() => addMedicineToGrid(med)}
                          >
                            <span className="font-medium text-foreground">{med.BrandName}</span>
                            <span className="text-muted-foreground text-xs">{med.Barcode || "No Barcode"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative w-full sm:w-48 hidden md:block">
                    <Input 
                      id="search-barcode"
                      placeholder="Scan / Enter Barcode" 
                      className="h-9 text-sm text-center font-mono"
                      value={barcodeQuery}
                      onChange={e=>setBarcodeQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddByBarcode();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[1200px] text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-3 py-2.5 font-semibold w-10 text-center">#</th>
                      <th className="px-3 py-2.5 font-semibold w-56">Medicine Name</th>
                      <th className="px-3 py-2.5 font-semibold w-32">Batch No. <span className="text-rose-500">*</span></th>
                      <th className="px-3 py-2.5 font-semibold w-36">Mfg Date</th>
                      <th className="px-3 py-2.5 font-semibold w-36">Expiry Date <span className="text-rose-500">*</span></th>
                      <th className="px-3 py-2.5 font-semibold w-28">Pur. Price</th>
                      <th className="px-3 py-2.5 font-semibold w-28">Sale Price</th>
                      <th className="px-3 py-2.5 font-semibold w-20">Qty</th>
                      <th className="px-3 py-2.5 font-semibold w-20">Free</th>
                      <th className="px-3 py-2.5 font-semibold w-24">Disc %</th>
                      <th className="px-3 py-2.5 font-semibold w-20">Tax %</th>
                      <th className="px-3 py-2.5 font-semibold w-28">Line Total</th>
                      <th className="px-3 py-2.5 font-semibold w-16 text-center">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-4 py-16 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center">
                            <ShoppingCart className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                            <p>No medicines added yet.</p>
                            <p className="text-xs mt-1">Search or scan a medicine to add it to the invoice.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-3 py-2 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{item.MedicineName}</td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`batch-${item.id}`}
                              value={item.BatchCode} 
                              onChange={e => updateItem(item.id, 'BatchCode', e.target.value.toUpperCase())}
                              onKeyDown={e => handleEnterKey(e, `mfg-${item.id}`)}
                              className="h-8 text-xs font-mono px-2"
                              placeholder="Required"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`mfg-${item.id}`}
                              type="date"
                              value={item.ManufacturingDate} 
                              onChange={e => updateItem(item.id, 'ManufacturingDate', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `expiry-${item.id}`)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`expiry-${item.id}`}
                              type="date"
                              value={item.ExpiryDate} 
                              onChange={e => updateItem(item.id, 'ExpiryDate', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `cost-${item.id}`)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`cost-${item.id}`}
                              type="number" min="0" step="0.01"
                              value={item.CostPrice} 
                              onChange={e => updateItem(item.id, 'CostPrice', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `sale-${item.id}`)}
                              className="h-8 text-xs px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`sale-${item.id}`}
                              type="number" min="0" step="0.01"
                              value={item.SellingPrice} 
                              onChange={e => updateItem(item.id, 'SellingPrice', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `qty-${item.id}`)}
                              className="h-8 text-xs px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`qty-${item.id}`}
                              type="number" min="1"
                              value={item.Quantity} 
                              onChange={e => updateItem(item.id, 'Quantity', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `free-${item.id}`)}
                              className="h-8 text-xs px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`free-${item.id}`}
                              type="number" min="0"
                              value={item.FreeQty} 
                              onChange={e => updateItem(item.id, 'FreeQty', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `disc-${item.id}`)}
                              className="h-8 text-xs px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`disc-${item.id}`}
                              type="number" min="0" max="100" step="0.1"
                              value={item.Discount} 
                              onChange={e => updateItem(item.id, 'Discount', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, `tax-${item.id}`)}
                              className="h-8 text-xs px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              id={`tax-${item.id}`}
                              type="number" min="0" max="100"
                              value={item.TaxPercentage} 
                              onChange={e => updateItem(item.id, 'TaxPercentage', e.target.value)}
                              onKeyDown={e => handleEnterKey(e, 'search-barcode')}
                              className="h-8 text-xs px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">
                            ₨ {formatNumber(Number(item.LineTotal || 0))}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeItem(item.id)} className="text-rose-500 hover:text-rose-700 transition-colors p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="px-4 py-3 bg-slate-50 dark:bg-secondary/20 border-t border-border flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">Total Items: {items.length}</span>
                <div className="flex gap-6 font-semibold text-slate-700 dark:text-slate-300">
                  <span>Total Quantity: {items.reduce((acc, curr) => acc + Number(curr.Quantity), 0)}</span>
                  <span>Total Free Qty: {items.reduce((acc, curr) => acc + Number(curr.FreeQty), 0)}</span>
                </div>
              </div>
            </div>

          </div>
        )}


        {/* --- HISTORY TAB --- */}
        {activeTab === "history" && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-6 py-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-foreground">Purchase Invoices History</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search invoice or supplier..." className="h-9 pl-9" value={historySearchQuery} onChange={e => setHistorySearchQuery(e.target.value)} />
                </div>
                <div className="w-full sm:w-48">
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={filterSupplierId} onChange={e => setFilterSupplierId(Number(e.target.value))}
                  >
                    <option value={0}>All Suppliers</option>
                    {suppliers.map(s => <option key={s.SupplierId} value={s.SupplierId}>{s.Name}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-36">
                  <Input type="date" className="h-9 text-sm" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} title="From Date" />
                </div>
                <div className="w-full sm:w-36">
                  <Input type="date" className="h-9 text-sm" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} title="To Date" />
                </div>
                {(historySearchQuery || filterSupplierId > 0 || filterFromDate || filterToDate) && (
                  <Button variant="ghost" onClick={() => { setHistorySearchQuery(""); setFilterSupplierId(0); setFilterFromDate(""); setFilterToDate(""); }} className="h-9 px-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0">
                    Clear
                  </Button>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-3 font-semibold w-12 text-center">#</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Invoice No.</th>
                    <th className="px-6 py-3 font-semibold">Supplier</th>
                    <th className="px-6 py-3 font-semibold text-right">Grand Total</th>
                    <th className="px-6 py-3 font-semibold text-right">Paid</th>
                    <th className="px-6 py-3 font-semibold text-right">Due / Balance</th>
                    <th className="px-6 py-3 font-semibold text-center">Status</th>
                    <th className="px-6 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-muted-foreground">
                        <FileText className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <p>No purchase history found.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((inv, index) => {
                      const balance = Math.max(0, (inv.GrandTotal || 0) - (inv.PaidAmount || 0));
                      let dynamicStatus = "";
                      if (balance <= 0) dynamicStatus = "Paid";
                      else if ((inv.PaidAmount || 0) > 0) dynamicStatus = "Partial";
                      else dynamicStatus = "Unpaid";
                      
                      return (
                      <tr 
                        key={inv.PurchaseId} 
                        className="hover:bg-secondary/10 transition-colors cursor-pointer"
                        onClick={() => setViewingInvoice(inv)}
                      >
                        <td className="px-6 py-3 text-center font-medium text-muted-foreground">{(historyCurrentPage - 1) * historyPageSize + index + 1}</td>
                        <td className="px-6 py-3 text-muted-foreground">{new Date(inv.PurchaseDate).toLocaleDateString()}</td>
                        <td className="px-6 py-3">
                           <div className="font-medium text-slate-800 dark:text-slate-200">{inv.InvoiceNumber}</div>
                           {(inv as any).SupplierInvNo && <div className="text-xs text-slate-500 mt-0.5">Ref: {(inv as any).SupplierInvNo}</div>}
                        </td>
                        <td className="px-6 py-3">{inv.SupplierName || 'Unknown Supplier'}</td>
                        <td className="px-6 py-3 text-right font-semibold">₨ {formatNumber(Number(inv.GrandTotal || 0))}</td>
                        <td className="px-6 py-3 text-right text-emerald-600">₨ {formatNumber(Number(inv.PaidAmount || 0))}</td>
                        <td className="px-6 py-3 text-right">
                          {balance > 0 ? (
                            <span className="font-semibold text-rose-500">₨ {formatNumber(balance)}</span>
                          ) : (
                            <span className="text-slate-400">₨ 0.00</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            dynamicStatus === "Paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            dynamicStatus === "Partial" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                            "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          )}>
                            {dynamicStatus}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={() => setViewingInvoice(inv)}
                              title="View Invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                              onClick={() => {
                                setViewingInvoice(inv);
                                setTimeout(() => window.print(), 300);
                              }}
                              title="Print Invoice"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
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
                  value={historyPageSize}
                  onChange={e => { setHistoryPageSize(Number(e.target.value)); setHistoryCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  Showing {Math.min(filteredPurchaseHistory.length, (historyCurrentPage - 1) * historyPageSize + (filteredPurchaseHistory.length > 0 ? 1 : 0))}–{Math.min(filteredPurchaseHistory.length, historyCurrentPage * historyPageSize)} of {filteredPurchaseHistory.length}
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" size="sm" className="h-8 px-3"
                    onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                    disabled={historyCurrentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button 
                    variant="outline" size="sm" className="h-8 px-3"
                    onClick={() => setHistoryCurrentPage(p => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyCurrentPage >= totalHistoryPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* --- RETURNS TAB --- */}
        {activeTab === "returns" && (
          <div className="flex flex-col xl:flex-row gap-6 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Left Side: Original Invoice Selection & Grid */}
            <div className="flex-1 w-full space-y-6">
              
              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Select Original Purchase Invoice</label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedReturnInvoice?.PurchaseId?.toString() || ""}
                      onChange={e=>handleReturnInvoiceSelect(e.target.value)}
                    >
                      <option value="">-- Select an Invoice to Return --</option>
                      {purchaseHistory.map(inv => (
                        <option key={inv.PurchaseId} value={inv.PurchaseId.toString()}>
                          {inv.InvoiceNumber} - {inv.SupplierName} ({new Date(inv.PurchaseDate).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-1/3 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Debit Note No.</label>
                    <Input value={returnInvNo} disabled className="h-9 bg-slate-50 dark:bg-secondary/50 font-medium" />
                  </div>
                </div>
              </div>

              {selectedReturnInvoice && (
                <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-secondary/20">
                    <h3 className="font-semibold text-sm text-foreground">Specify Return Quantities</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                          <th className="px-4 py-2 font-semibold">Medicine</th>
                          <th className="px-4 py-2 font-semibold">Batch Code</th>
                          <th className="px-4 py-2 font-semibold text-center">Orig. Qty</th>
                          <th className="px-4 py-2 font-semibold text-right">Unit Price</th>
                          <th className="px-4 py-2 font-semibold text-center text-primary">Return Qty</th>
                          <th className="px-4 py-2 font-semibold text-center">Reason</th>
                          <th className="px-4 py-2 font-semibold text-right text-rose-500">Refund Amt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {returnItems.map(item => (
                          <tr key={item.PurchaseItemId} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-4 py-2 font-medium">{item.MedicineName}</td>
                            <td className="px-4 py-2 font-mono text-xs">{item.BatchCode}</td>
                            <td className="px-4 py-2 text-center text-muted-foreground">{item.OriginalQty}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs">₨ {formatNumber(Number(item.CostPrice || 0))}</td>
                            <td className="px-4 py-2">
                              <div className="flex justify-center">
                                <Input 
                                  type="number" min="0" max={item.OriginalQty}
                                  value={item.ReturnQty} 
                                  onChange={e => updateReturnItem(item.PurchaseItemId, 'ReturnQty', e.target.value)}
                                  className="h-8 w-20 text-center border-primary/50 focus-visible:ring-primary font-mono"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex justify-center">
                                <select
                                  className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-[120px]"
                                  value={item.ReturnReason}
                                  onChange={e => updateReturnItem(item.PurchaseItemId, 'ReturnReason', e.target.value)}
                                >
                                  <option value="Expired">Expired</option>
                                  <option value="Damaged">Damaged</option>
                                  <option value="Near Expiry">Near Expiry</option>
                                  <option value="Slow Moving">Slow Moving</option>
                                  <option value="Wrong Delivery">Wrong Delivery</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-rose-500 font-mono text-xs">
                              ₨ {formatNumber(Number(item.RefundAmount || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Returns History Table */}
              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden mt-8">
                <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-secondary/20">
                  <h3 className="font-semibold text-sm text-foreground">Debit Notes History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                        <th className="px-4 py-2 font-semibold w-12 text-center">#</th>
                        <th className="px-4 py-2 font-semibold">Date</th>
                        <th className="px-4 py-2 font-semibold">Debit Note</th>
                        <th className="px-4 py-2 font-semibold">Original Inv.</th>
                        <th className="px-4 py-2 font-semibold">Supplier</th>
                        <th className="px-4 py-2 font-semibold">Settlement Type</th>
                        <th className="px-4 py-2 font-semibold text-right">Refund Amount</th>
                        <th className="px-4 py-2 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {returnsHistory.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-12 text-muted-foreground"><div className="flex flex-col items-center gap-2"><Undo2 className="h-10 w-10 opacity-20" /><span>No debit notes processed yet.</span></div></td></tr>
                      ) : (
                        returnsHistory
                          .slice((returnsCurrentPage - 1) * returnsPageSize, returnsCurrentPage * returnsPageSize)
                          .map((r, index) => (
                          <tr key={r.ReturnId} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-4 py-2 text-center font-medium text-muted-foreground">{(returnsCurrentPage - 1) * returnsPageSize + index + 1}</td>
                            <td className="px-4 py-2 text-muted-foreground">{new Date(r.ReturnDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2 font-medium">{r.ReturnInvoiceNumber}</td>
                            <td className="px-4 py-2 text-slate-600">{r.OriginalInvoiceNumber || "-"}</td>
                            <td className="px-4 py-2">{r.SupplierName}</td>
                            <td className="px-4 py-2">
                              <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold tracking-wide", 
                                r.SettlementType === 'Cash Refund' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                              )}>
                                {r.SettlementType || 'Ledger Adjusted'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-rose-500 font-mono">₨ {formatNumber(Number(r.TotalRefundAmount || 0))}</td>
                            <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => setViewingInvoice(r)} title="View Debit Note"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                                  onClick={() => { setViewingInvoice(r); setTimeout(() => window.print(), 300); }} title="Print Debit Note"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Debit Notes Pagination Footer */}
                {(() => {
                  const totalReturnsPages = Math.max(1, Math.ceil(returnsHistory.length / returnsPageSize));
                  const startIdx = returnsHistory.length === 0 ? 0 : (returnsCurrentPage - 1) * returnsPageSize + 1;
                  const endIdx = Math.min(returnsCurrentPage * returnsPageSize, returnsHistory.length);
                  return (
                    <div className="px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={returnsPageSize}
                          onChange={e => { setReturnsPageSize(Number(e.target.value)); setReturnsCurrentPage(1); }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          Showing {startIdx}–{endIdx} of {returnsHistory.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline" size="sm" className="h-8 px-3"
                            onClick={() => setReturnsCurrentPage(p => Math.max(1, p - 1))}
                            disabled={returnsCurrentPage === 1}
                          >
                            Prev
                          </Button>
                          <Button
                            variant="outline" size="sm" className="h-8 px-3"
                            onClick={() => setReturnsCurrentPage(p => Math.min(totalReturnsPages, p + 1))}
                            disabled={returnsCurrentPage >= totalReturnsPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Side: Return Summary */}
            {selectedReturnInvoice && (
              <div className="w-full xl:w-[320px] shrink-0 space-y-4">
                <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-5">
                  <h3 className="font-bold text-base flex items-center gap-2 border-b border-border pb-3 mb-4">
                    <ArrowDownToLine className="h-5 w-5 text-rose-500" /> Return Summary
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Settlement Method</label>
                      <select 
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={settlementType}
                        onChange={e=>setSettlementType(e.target.value)}
                      >
                        <option value="Adjust in Supplier Balance">Adjust in Supplier Balance</option>
                        <option value="Cash Refund">Cash Refund</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Global Note (Optional)</label>
                      <textarea 
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                        placeholder="Additional notes for this debit note..."
                        value={returnReason}
                        onChange={e=>setReturnReason(e.target.value)}
                      />
                    </div>
                    
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-base text-foreground">Total Refund Due</span>
                        <span className="font-bold text-xl text-rose-500 font-mono">₨ {formatNumber(Number(totalRefundDue || 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button onClick={handleSaveReturn} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm w-full h-11" disabled={totalRefundDue <= 0}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Process Return (Generate Debit Note)
                </Button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- INVOICE DETAILS MODAL --- */}
      {printData && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Modal Header */}
            <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-inner">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {printData.IsReturn ? "Debit Note Details" : (showDraftPreview ? "Draft Invoice Preview" : "Invoice Details")}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    ID: <span className="text-slate-700 dark:text-slate-300 font-mono">{printData.InvoiceNumber}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 h-10 px-5 transition-all">
                  <Printer className="h-4 w-4 mr-2" /> Print PDF
                </Button>
                <button 
                  onClick={() => { setViewingInvoice(null); setShowDraftPreview(false); }}
                  className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-[#0f172a]">
              
              {/* Premium Header Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Supplier Details</h3>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{printData.SupplierName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Authorized Pharmaceutical Distributor</p>
                  </div>
                </div>
                <div className="md:text-right">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Purchase Info</h3>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Date: <span className="font-semibold text-slate-900 dark:text-slate-200">{new Date(printData.PurchaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Status: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Completed</span></p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3.5 font-bold">Medicine</th>
                      <th className="px-5 py-3.5 font-bold">Batch</th>
                      <th className="px-5 py-3.5 font-bold">Expiry</th>
                      <th className="px-5 py-3.5 font-bold text-center">Qty</th>
                      <th className="px-5 py-3.5 font-bold text-center">Free</th>
                      <th className="px-5 py-3.5 font-bold text-right">Cost</th>
                      <th className="px-5 py-3.5 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {printData.items.map((item: any, idx: number) => (
                      <tr key={item.PurchaseItemId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{item.MedicineName}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">{item.BatchCode || "-"}</td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.ExpiryDate || "-"}</td>
                        <td className="px-5 py-4 text-center font-medium text-slate-800 dark:text-slate-200">{item.Quantity}</td>
                        <td className="px-5 py-4 text-center text-slate-500">{item.FreeQty || 0}</td>
                        <td className="px-5 py-4 text-right text-slate-600 dark:text-slate-400">₨ {formatNumber(Number(item.CostPrice || 0))}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white">₨ {formatNumber(Number(item.LineTotal || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Grand Totals */}
              <div className="mt-8 flex justify-end">
                <div className="w-80 rounded-2xl bg-slate-50 dark:bg-slate-900 p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span className="font-bold">Grand Total</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200">₨ {formatNumber(Number(printData.GrandTotal || 0))}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium pt-3 border-t border-slate-200 dark:border-slate-800">
                      <span>Amount Paid</span>
                      <span>₨ {formatNumber(Number(printData.PaidAmount || 0))}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-base text-slate-900 dark:text-white">Balance Due</span>
                      <span className="font-bold text-xl text-rose-500">₨ {formatNumber(Number((printData.GrandTotal || 0) - (printData.PaidAmount || 0)))}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      
    </div>

    {/* --- PRINT ONLY LAYOUT --- */}
    <div id="printable-invoice" className="hidden print:block bg-white text-black w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          @page {
            size: auto;
            margin: 10mm;
          }
        }
      `}} />
      
      {printData && (
        <div className="max-w-[210mm] mx-auto bg-white p-8">
          
          {/* Header Section */}
          <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <FileText size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">CarePlus Pharmacy</h1>
                <p className="text-sm font-semibold text-slate-500 tracking-widest mt-1 uppercase">{printData.IsReturn ? "Purchase Return Record" : "Purchase Record"}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-black text-slate-200 tracking-tighter uppercase">{printData.IsReturn ? "Debit Note" : "Invoice"}</h2>
              <p className="text-sm font-semibold text-slate-800 mt-2">No: <span className="text-slate-600 font-mono">{printData.InvoiceNumber}</span></p>
              <p className="text-sm font-semibold text-slate-800">Date: <span className="text-slate-600 font-mono">{new Date(printData.PurchaseDate).toLocaleDateString('en-GB')}</span></p>
            </div>
          </div>
          
          {/* Meta Information */}
          <div className="grid grid-cols-2 gap-12 mb-10">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Distributor / Supplier</h3>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-xl font-bold text-slate-900">{printData.SupplierName}</p>
                <p className="text-sm text-slate-500 mt-1">Authorized Pharmaceutical Supplier</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ship To / Facility</h3>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-lg font-bold text-slate-900">CarePlus Central Pharmacy</p>
                <p className="text-sm text-slate-500 mt-1">123 Health Ave, Medical District<br/>City, State, ZIP</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-10 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-sm">
               <thead>
                 <tr className="bg-slate-900 text-white">
                   <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider w-[40%]">Item Description</th>
                   <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Batch/Exp</th>
                   <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-center">Qty</th>
                   <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">Unit Price</th>
                   <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">Total</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {printData.items.map((item: any, idx: number) => (
                   <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                     <td className="py-3 px-4 text-slate-900 font-bold">{item.MedicineName}</td>
                     <td className="py-3 px-4">
                       <div className="text-slate-800 font-mono text-xs font-semibold">{item.BatchCode || "N/A"}</div>
                       <div className="text-slate-400 text-[10px] mt-0.5">Exp: {item.ExpiryDate || "N/A"}</div>
                     </td>
                     <td className="py-3 px-4 text-center font-semibold text-slate-800">
                        {item.Quantity}
                        {item.FreeQty > 0 && <span className="text-slate-400 text-xs ml-1">(+{item.FreeQty})</span>}
                     </td>
                     <td className="py-3 px-4 text-right text-slate-600 font-mono text-xs">₨ {formatNumber(Number(item.CostPrice || 0))}</td>
                     <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">₨ {formatNumber(Number(item.LineTotal || 0))}</td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-16">
             <div className="w-[320px]">
                <div className="space-y-3 p-5 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm">
                   <div className="flex justify-between text-slate-600 font-semibold">
                      <span>{printData.IsReturn ? "Total Return Value" : "Subtotal"}</span>
                      <span className="font-mono">₨ {formatNumber(Number(printData.GrandTotal || 0))}</span>
                   </div>
                   {!printData.IsReturn && (
                     <div className="flex justify-between text-slate-600 font-semibold pb-3 border-b border-slate-200">
                        <span>Amount Paid</span>
                        <span className="font-mono text-emerald-600">₨ {formatNumber(Number(printData.PaidAmount || 0))}</span>
                     </div>
                   )}
                   {printData.IsReturn && (
                     <div className="flex justify-between text-slate-600 font-semibold pb-3 border-b border-slate-200">
                        <span>Settlement</span>
                        <span className="font-semibold text-emerald-600">{printData.SettlementType}</span>
                     </div>
                   )}
                   <div className="flex justify-between font-black text-xl text-slate-900 pt-2 items-center">
                      <span>{printData.IsReturn ? "Refund Total" : "Balance Due"}</span>
                      <span className="font-mono text-rose-600">₨ {formatNumber(Number(printData.IsReturn ? printData.GrandTotal : ((printData.GrandTotal || 0) - (printData.PaidAmount || 0))))}</span>
                   </div>
                </div>
             </div>
          </div>
          
          {/* Signatures & Footer */}
          <div className="pt-16 mt-8 flex justify-between items-end">
             <div className="w-48 text-center border-t border-slate-300 pt-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Received By</p>
             </div>
             <div className="text-center text-slate-400 text-xs">
                <p className="font-semibold text-slate-500">CarePlus Pharmacy Management System</p>
                <p className="mt-1">Computer Generated Document</p>
             </div>
             <div className="w-48 text-center border-t border-slate-300 pt-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Authorized Signatory</p>
             </div>
          </div>
          
        </div>
      )}
    </div>
    </>
  );
}
