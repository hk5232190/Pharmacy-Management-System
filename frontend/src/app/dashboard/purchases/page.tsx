"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, DollarSign, Undo2, Users, FileText, 
  Search, Plus, Save, Printer, Eye, X, Trash2, Calendar,
  ArrowDownToLine
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

export default function PurchasesPage() {
  const { formatNumber } = useSystemPreferences();
  // --- Tabs ---
  const [activeTab, setActiveTab] = useState<"invoice" | "history" | "returns">("invoice");

  // --- States for Invoice Tab ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  
  // Invoice Info
  const [invoiceNo, setInvoiceNo] = useState(`PI-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
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

  // --- States for Returns Tab ---
  const [returnsHistory, setReturnsHistory] = useState<any[]>([]);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<PurchaseHistory | null>(null);
  const [returnItems, setReturnItems] = useState<{ PurchaseItemId: number; MedicineId: number; MedicineName: string; BatchCode: string; OriginalQty: number; ReturnQty: number; CostPrice: number; RefundAmount: number }[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnInvNo, setReturnInvNo] = useState(`DN-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`);
  const [summaryData, setSummaryData] = useState<any>(null);

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
    calculateTotals();
  }, [items, paymentStatus]);

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
        if (['CostPrice', 'Quantity', 'Discount', 'TaxPercentage'].includes(field)) {
          const qty = Number(updated.Quantity) || 0;
          const cost = Number(updated.CostPrice) || 0;
          const discount = Number(updated.Discount) || 0;
          const taxPct = Number(updated.TaxPercentage) || 0;
          
          const base = (qty * cost) - discount;
          const taxAmt = base * (taxPct / 100);
          updated.LineTotal = base + taxAmt;
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
      const itemDisc = Number(item.Discount) || 0;
      const taxPct = Number(item.TaxPercentage) || 0;
      
      const basePrice = qty * cost;
      const taxAmt = (basePrice - itemDisc) * (taxPct / 100);
      
      sub += basePrice;
      disc += itemDisc;
      tax += taxAmt;
      grand += (basePrice - itemDisc + taxAmt);
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
    if (!supplierId) return toast.error("Please select a supplier");
    if (items.length === 0) return toast.error("Please add at least one medicine to the invoice");
    
    for (const item of items) {
      if (!item.BatchCode) return toast.error(`Missing Batch Code for ${item.MedicineName}`);
      if (!item.ExpiryDate) return toast.error(`Missing Expiry Date for ${item.MedicineName}`);
      
      if (Number(item.CostPrice) > Number(item.SellingPrice)) {
        return toast.error(`Cost Price cannot exceed Sale Price for ${item.MedicineName} (SRS Rule)`);
      }
      
      const expDate = new Date(item.ExpiryDate);
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
        RefundAmount: 0
      })));
    }
  };

  const updateReturnItem = (itemId: number, returnQty: string) => {
    const qtyNum = Number(returnQty);
    setReturnItems(returnItems.map(item => {
      if (item.PurchaseItemId === itemId) {
        const qty = Math.min(Math.max(0, qtyNum), item.OriginalQty);
        return { ...item, ReturnQty: qty, RefundAmount: qty * item.CostPrice };
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
      items: itemsToReturn.map(i => ({
        MedicineId: i.MedicineId,
        BatchCode: i.BatchCode,
        ReturnQuantity: i.ReturnQty,
        RefundAmount: i.RefundAmount
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
  const printData = viewingInvoice || (showDraftPreview ? {
    InvoiceNumber: invoiceNo,
    SupplierName: suppliers.find(s => s.SupplierId === supplierId)?.Name || "Unknown Supplier",
    PurchaseDate: purchaseDate,
    GrandTotal: grandTotal,
    PaidAmount: paidAmount,
    items: items.map(i => ({ ...i, PurchaseItemId: i.id }))
  } as any : null);

  // --- Render ---
  return (
    <>
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-background overflow-hidden relative print:hidden">
      
      {/* Header & Stats Container */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6">
        
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Purchase Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Purchase medicines, manage supplier invoices, receive stock, process purchase returns, and maintain complete purchase records.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Today's Purchases</p>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">₨ {fmt(summaryData?.today_purchase_amount || 0)}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Purchase Amount</p>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">₨ {fmt(summaryData?.total_purchase_amount || 0)}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Undo2 size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Processed Returns</p>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{summaryData?.total_returns_count || returnsHistory.length}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Suppliers</p>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{summaryData?.total_suppliers_count || suppliers.length}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Invoices</p>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{summaryData?.total_invoices_count || purchaseHistory.length}</h3>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border mb-6">
          <button 
            onClick={() => setActiveTab("invoice")}
            className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors", activeTab === "invoice" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
          >
            Purchase Invoice
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors", activeTab === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
          >
            Purchase History
          </button>
          <button 
            onClick={() => setActiveTab("returns")}
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
                <div className="p-4 grid grid-cols-2 gap-x-5 gap-y-3">
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
                        setPaymentStatus(e.target.value);
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
                      {paymentStatus === "Paid" ? (
                        <span className="font-medium text-emerald-400">Rs. {formatNumber(Number(grandTotal || 0))}</span>
                      ) : (
                        <Input
                          type="number" min="0" step="0.01"
                          value={paidAmount}
                          onChange={e => setPaidAmount(Number(e.target.value))}
                          className="h-7 text-xs px-2 text-right text-emerald-400 font-semibold bg-slate-800 border-slate-600"
                        />
                      )}
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
                  
                  <Button size="sm" onClick={handleAddByBarcode} className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
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
                      <th className="px-3 py-2.5 font-semibold w-24">Disc (₨)</th>
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
                              value={item.BatchCode} 
                              onChange={e => updateItem(item.id, 'BatchCode', e.target.value.toUpperCase())}
                              className="h-8 text-xs font-mono px-2"
                              placeholder="Required"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="date"
                              value={item.ManufacturingDate} 
                              onChange={e => updateItem(item.id, 'ManufacturingDate', e.target.value)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="date"
                              value={item.ExpiryDate} 
                              onChange={e => updateItem(item.id, 'ExpiryDate', e.target.value)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" min="0" step="0.01"
                              value={item.CostPrice} 
                              onChange={e => updateItem(item.id, 'CostPrice', e.target.value)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" min="0" step="0.01"
                              value={item.SellingPrice} 
                              onChange={e => updateItem(item.id, 'SellingPrice', e.target.value)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" min="1"
                              value={item.Quantity} 
                              onChange={e => updateItem(item.id, 'Quantity', e.target.value)}
                              className="h-8 text-xs px-2 text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" min="0"
                              value={item.FreeQty} 
                              onChange={e => updateItem(item.id, 'FreeQty', e.target.value)}
                              className="h-8 text-xs px-2 text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" min="0" step="0.01"
                              value={item.Discount} 
                              onChange={e => updateItem(item.id, 'Discount', e.target.value)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" min="0" max="100"
                              value={item.TaxPercentage} 
                              onChange={e => updateItem(item.id, 'TaxPercentage', e.target.value)}
                              className="h-8 text-xs px-2 text-center"
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
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
            <div className="px-6 py-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Purchase Invoices History</h3>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search invoice or supplier..." className="h-9 pl-9" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Invoice No.</th>
                    <th className="px-6 py-3 font-semibold">Supplier</th>
                    <th className="px-6 py-3 font-semibold text-right">Grand Total</th>
                    <th className="px-6 py-3 font-semibold text-right">Paid</th>
                    <th className="px-6 py-3 font-semibold text-center">Status</th>
                    <th className="px-6 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchaseHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                        <FileText className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <p>No purchase history found.</p>
                      </td>
                    </tr>
                  ) : (
                    purchaseHistory.map(inv => (
                      <tr key={inv.PurchaseId} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-6 py-3 text-muted-foreground">{new Date(inv.PurchaseDate).toLocaleDateString()}</td>
                        <td className="px-6 py-3 font-medium">{inv.InvoiceNumber}</td>
                        <td className="px-6 py-3">{inv.SupplierName || 'Unknown Supplier'}</td>
                        <td className="px-6 py-3 text-right font-semibold">₨ {formatNumber(Number(inv.GrandTotal || 0))}</td>
                        <td className="px-6 py-3 text-right text-emerald-600">₨ {formatNumber(Number(inv.PaidAmount || 0))}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            inv.PaymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            inv.PaymentStatus === "Partial" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                            "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          )}>
                            {inv.PaymentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => setViewingInvoice(inv)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                          <th className="px-4 py-2 font-semibold text-right">Cost Price</th>
                          <th className="px-4 py-2 font-semibold text-center text-primary">Return Qty</th>
                          <th className="px-4 py-2 font-semibold text-right text-rose-500">Refund Amt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {returnItems.map(item => (
                          <tr key={item.PurchaseItemId} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-4 py-2 font-medium">{item.MedicineName}</td>
                            <td className="px-4 py-2 font-mono text-xs">{item.BatchCode}</td>
                            <td className="px-4 py-2 text-center text-muted-foreground">{item.OriginalQty}</td>
                            <td className="px-4 py-2 text-right">₨ {formatNumber(Number(item.CostPrice || 0))}</td>
                            <td className="px-4 py-2">
                              <div className="flex justify-center">
                                <Input 
                                  type="number" min="0" max={item.OriginalQty}
                                  value={item.ReturnQty} 
                                  onChange={e => updateReturnItem(item.PurchaseItemId, e.target.value)}
                                  className="h-8 w-24 text-center border-primary/50 focus-visible:ring-primary"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-rose-500">
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
                        <th className="px-4 py-2 font-semibold">Date</th>
                        <th className="px-4 py-2 font-semibold">Debit Note</th>
                        <th className="px-4 py-2 font-semibold">Supplier</th>
                        <th className="px-4 py-2 font-semibold text-right">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {returnsHistory.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No returns processed yet.</td></tr>
                      ) : (
                        returnsHistory.map(r => (
                          <tr key={r.ReturnId}>
                            <td className="px-4 py-2 text-muted-foreground">{new Date(r.ReturnDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2 font-medium">{r.ReturnInvoiceNumber}</td>
                            <td className="px-4 py-2">{r.SupplierName}</td>
                            <td className="px-4 py-2 text-right font-bold text-rose-500">₨ {formatNumber(Number(r.TotalRefundAmount || 0))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Side: Return Summary */}
            {selectedReturnInvoice && (
              <div className="w-full xl:w-[320px] shrink-0 space-y-4">
                <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-5">
                  <h3 className="font-bold text-base flex items-center gap-2 border-b border-border pb-3 mb-4">
                    <ArrowDownToLine className="h-5 w-5 text-rose-500" /> Return Summary
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Reason for Return</label>
                      <textarea 
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar"
                        placeholder="e.g. Expired stock, Damaged goods..."
                        value={returnReason}
                        onChange={e=>setReturnReason(e.target.value)}
                      />
                    </div>
                    
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-base text-foreground">Total Refund Due</span>
                        <span className="font-bold text-xl text-rose-500">₨ {formatNumber(Number(totalRefundDue || 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button onClick={handleSaveReturn} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm w-full h-11" disabled={totalRefundDue <= 0}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Process Return & Deduct Stock
                </Button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- INVOICE DETAILS MODAL --- */}
      {printData && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-full overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-secondary/20">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {showDraftPreview ? "Draft Invoice Preview: " : "Invoice Details: "}
                  {printData.InvoiceNumber}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Supplier: {printData.SupplierName} | Date: {new Date(printData.PurchaseDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-sm">
                  <Printer className="h-4 w-4 mr-2" /> Print PDF
                </Button>
                <button 
                  onClick={() => { setViewingInvoice(null); setShowDraftPreview(false); }}
                  className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-2 font-semibold">Medicine</th>
                    <th className="px-4 py-2 font-semibold">Batch</th>
                    <th className="px-4 py-2 font-semibold">Expiry</th>
                    <th className="px-4 py-2 font-semibold text-center">Qty</th>
                    <th className="px-4 py-2 font-semibold text-center">Free</th>
                    <th className="px-4 py-2 font-semibold text-right">Cost</th>
                    <th className="px-4 py-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {printData.items.map((item: any, idx: number) => (
                    <tr key={item.PurchaseItemId || idx} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-3 font-medium">{item.MedicineName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.BatchCode || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.ExpiryDate || "-"}</td>
                      <td className="px-4 py-3 text-center">{item.Quantity}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{item.FreeQty || 0}</td>
                      <td className="px-4 py-3 text-right">₨ {formatNumber(Number(item.CostPrice || 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold">₨ {formatNumber(Number(item.LineTotal || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-6 flex justify-end">
                <div className="w-64 space-y-2 text-sm bg-slate-50 dark:bg-secondary/20 p-4 rounded-xl border border-border">
                  <div className="flex justify-between font-bold text-base border-b border-border pb-2 mb-2">
                    <span>Grand Total:</span>
                    <span>₨ {formatNumber(Number(printData.GrandTotal || 0))}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Paid:</span>
                    <span>₨ {formatNumber(Number(printData.PaidAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-rose-500 font-medium">
                    <span>Balance:</span>
                    <span>₨ {formatNumber(Number((printData.GrandTotal || 0) - (printData.PaidAmount || 0)))}</span>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}
      
    </div>

    {/* --- PRINT ONLY LAYOUT --- */}
    <div className="hidden print:block bg-white text-black min-h-screen p-8">
      {printData && (
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Print Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">PURCHASE INVOICE</h1>
              <p className="text-sm font-medium text-slate-500 mt-2">Invoice No: {printData.InvoiceNumber}</p>
            </div>
            <div className="text-right">
              <h2 className="font-bold text-2xl text-slate-800">Pharmacy Management System</h2>
              <p className="text-sm text-slate-600 mt-1">123 Health Ave, Medical District</p>
              <p className="text-sm text-slate-600">Date: {new Date(printData.PurchaseDate).toLocaleDateString()}</p>
            </div>
          </div>
          
          {/* Print Supplier Info */}
          <div className="pb-4">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-1">Supplier Details:</h3>
            <p className="text-xl font-bold text-slate-800">{printData.SupplierName}</p>
          </div>

          {/* Print Items Table */}
          <table className="w-full text-left border-collapse mt-6">
             <thead>
               <tr className="border-b-2 border-slate-800 text-slate-800">
                 <th className="py-3 font-bold">Item Name</th>
                 <th className="py-3 font-bold">Batch</th>
                 <th className="py-3 font-bold text-center">Qty</th>
                 <th className="py-3 font-bold text-right">Cost Price</th>
                 <th className="py-3 font-bold text-right">Total</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-200">
               {printData.items.map((item: any, idx: number) => (
                 <tr key={idx}>
                   <td className="py-4 text-slate-800 font-medium">{item.MedicineName}</td>
                   <td className="py-4 text-slate-600 font-mono text-sm">{item.BatchCode || "-"}</td>
                   <td className="py-4 text-center text-slate-800">{item.Quantity}</td>
                   <td className="py-4 text-right text-slate-600">₨ {formatNumber(Number(item.CostPrice || 0))}</td>
                   <td className="py-4 text-right font-bold text-slate-800">₨ {formatNumber(Number(item.LineTotal || 0))}</td>
                 </tr>
               ))}
             </tbody>
          </table>

          {/* Print Totals */}
          <div className="flex justify-end pt-8">
             <div className="w-80 space-y-3">
                <div className="flex justify-between font-black text-xl border-b-2 border-slate-800 pb-3 text-slate-900">
                   <span>Grand Total:</span>
                   <span>₨ {formatNumber(Number(printData.GrandTotal || 0))}</span>
                </div>
                <div className="flex justify-between text-slate-700 font-medium text-lg pt-2">
                   <span>Paid Amount:</span>
                   <span>₨ {formatNumber(Number(printData.PaidAmount || 0))}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium text-lg pt-1">
                   <span>Balance Due:</span>
                   <span>₨ {formatNumber(Number((printData.GrandTotal || 0) - (printData.PaidAmount || 0)))}</span>
                </div>
             </div>
          </div>
          
          {/* Print Footer */}
          <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-500 text-sm">
            <p>Thank you for your business.</p>
            <p>Generated by Pharmacy Management System</p>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
