"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import useSWR from "swr";
import { apiClient, getApiBaseUrl } from "@/lib/api-client";
import { toast } from "sonner";
import { ReceiptPreview } from "@/components/receipt-preview";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Printer,
  Pause,
  ArrowRight,
  FileText,
  User,
  Plus,
  Eye,
  ArrowLeft,
  CreditCard,
  Smartphone,
  Banknote,
  CircleDollarSign,
  RefreshCcw,
  Check,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
import { useInventorySettings } from "@/contexts/InventorySettingsContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useSearchParams } from "next/navigation";
import ChallanPrint from "@/components/ChallanPrint";
import type { ChallanData } from "@/components/ChallanTemplate";

// --- Interfaces ---
interface SaleInit {
  InvoiceNumber: string;
  DefaultTaxRate: number;
  MaxDiscountPercentage: number;
  DiscountEnabled: boolean;
  DefaultDiscountRate?: number;
  RequireAdminPinForDiscount?: boolean;
  AdminDiscountThreshold?: number;
  DefaultPaymentMethod?: string;
  AutoPrintReceipt?: boolean;
  ShowKeyboardShortcuts?: boolean;
}

interface ProductSearchBatch {
  BatchId: number;
  BatchCode: string;
  ExpiryDate: string;
  AvailableStock: number;
  UnitPrice: number;
}

interface ProductSearchResponse {
  MedicineId: number;
  MedicineName: string;
  GenericName: string;
  RequiresPrescription: boolean;
  Batches: ProductSearchBatch[];
}

interface CartItem {
  id: string; // Unique ID for cart row (MedicineId + BatchId)
  MedicineId: number;
  MedicineName: string;
  BatchId: number;
  BatchCode: string;
  ExpiryDate: string;
  AvailableStock: number;
  UnitPrice: number;
  Quantity: number;
  Discount: number;
  TaxPercent: number;
  LineTotal: number;
  RequiresPrescription: boolean;
}

export default function POSBillingPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading sales module...</div>}>
      <POSBillingPageContent />
    </Suspense>
  );
}

function POSBillingPageContent() {
  const { formatCurrency, currencySymbol } = useSystemPreferences();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === 'history' || tabParam === 'return' ? tabParam : 'pos';

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

  const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'return'>(initialTab);

  useEffect(() => {
    if (tabParam === 'history' || tabParam === 'return' || tabParam === 'pos') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return <POSBillingPage key={refreshKey} refreshState={refreshState} onRefresh={handleRefresh} activeTab={activeTab} onTabChange={setActiveTab} />;
}

function POSBillingPage({ onRefresh, refreshState, activeTab, onTabChange }: { onRefresh: () => void, refreshState: "idle" | "loading" | "done", activeTab: "pos" | "history" | "return", onTabChange: (tab: "pos" | "history" | "return") => void }) {
  const { formatNumber, formatCurrency, currencySymbol } = useSystemPreferences();
  const { inventorySettings } = useInventorySettings();
  const { profile } = useProfile();
  const [printerSettings, setPrinterSettings] = useState<any>(null);
  const [isPrintRetrying, setIsPrintRetrying] = useState(false);
  // (activeTab is now managed by the wrapper so it survives a refresh reset)
  const [loadingInit, setLoadingInit] = useState(true);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [taxRate, setTaxRate] = useState(0);

  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"percent" | "fixed">("percent");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState<number>(0);
  const [defaultDiscountRate, setDefaultDiscountRate] = useState<number>(0);

  const [maxDiscount, setMaxDiscount] = useState(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [salesperson, setSalesperson] = useState("");

  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [requireAdminPin, setRequireAdminPin] = useState(false);
  const [adminDiscountThreshold, setAdminDiscountThreshold] = useState(10);

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ Name: '', Phone: '', Address: '' });
  const [addingCustomer, setAddingCustomer] = useState(false);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.Name.trim()) return toast.error("Customer Name is required");
    setAddingCustomer(true);
    try {
      const res = await apiClient.post('/customers', newCustomer);
      if (res.success) {
        toast.success("Customer added successfully");
        setIsAddCustomerOpen(false);
        setNewCustomer({ Name: '', Phone: '', Address: '' });
        const custRes = await apiClient.get('/customers');
        if (custRes.success && custRes.data) {
          setCustomers(custRes.data);
          setSelectedCustomerId(res.data.CustomerId.toString());
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add customer");
    } finally {
      setAddingCustomer(false);
    }
  };

  const selectedCustomerName = selectedCustomerId === "walkin"
    ? "Walk-in Customer"
    : (customers.find((c: any) => String(c.CustomerId) === selectedCustomerId)?.Name ?? "Walk-in Customer");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedSearchIdx, setSelectedSearchIdx] = useState(-1);
  // ref map: cart item id -> qty input element
  const qtyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // track last added cart item id to focus its qty
  const lastAddedIdRef = useRef<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Digital" | "Credit" | "Bank Transfer">("Cash");
  const autoPrintRef = useRef(false);
  const showShortcutsRef = useRef(true);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(true);

  const [completedReceipt, setCompletedReceipt] = useState<any>(null);

  // --- Return States ---
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnInvoiceData, setReturnInvoiceData] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [refundMode, setRefundMode] = useState<"Cash Refund" | "Balance">("Cash Refund");

  // --- History States ---
  const swrFetcher = async (url: string) => {
    const res = await apiClient.get<any>(url);
    if (res.success === false) throw new Error(res.error);
    return res.data;
  };

  const [historyFilters, setHistoryFilters] = useState({ datePreset: "Today", startDate: "", endDate: "", paymentMethod: "", userId: "", q: "", status: "all" });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);

  const searchParams = useSearchParams();
  useEffect(() => {
    const qParam = searchParams.get("q");
    if (qParam) {
      setHistoryFilters(prev => ({ ...prev, q: qParam, datePreset: "All" }));
      onTabChange("history");
    }
  }, [searchParams, onTabChange]);

  const buildHistoryParams = () => {
    const params = new URLSearchParams();
    if (historyFilters.datePreset && historyFilters.datePreset !== "All") {
      const today = new Date();
      const formatDateLocal = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      if (historyFilters.datePreset === "Today") {
        params.append("start_date", formatDateLocal(today));
        params.append("end_date", formatDateLocal(today));
      } else if (historyFilters.datePreset === "Yesterday") {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        params.append("start_date", formatDateLocal(yest));
        params.append("end_date", formatDateLocal(yest));
      } else if (historyFilters.datePreset === "This Week") {
        const week = new Date(today);
        week.setDate(week.getDate() - today.getDay());
        params.append("start_date", formatDateLocal(week));
        params.append("end_date", formatDateLocal(today));
      } else if (historyFilters.datePreset === "This Month") {
        const month = new Date(today.getFullYear(), today.getMonth(), 1);
        params.append("start_date", formatDateLocal(month));
        params.append("end_date", formatDateLocal(today));
      } else if (historyFilters.datePreset === "This Year") {
        const year = new Date(today.getFullYear(), 0, 1);
        params.append("start_date", formatDateLocal(year));
        params.append("end_date", formatDateLocal(today));
      } else if (historyFilters.datePreset === "Custom Range") {
        if (historyFilters.startDate) params.append("start_date", historyFilters.startDate);
        if (historyFilters.endDate) params.append("end_date", historyFilters.endDate);
      }
    }
    
    if (historyFilters.status && historyFilters.status !== "all") {
      params.append("status", historyFilters.status);
    }
    params.append("page", String(historyPage));
    params.append("page_size", String(historyPageSize));
    if (historyFilters.q) params.append("q", historyFilters.q);
    return params.toString();
  };

    const isCustomRangeIncomplete = historyFilters.datePreset === 'Custom Range' && (!historyFilters.startDate || !historyFilters.endDate);
    const { data: historyData, mutate: mutateHistory, isLoading: loadingHistory } = useSWR(
      (activeTab === 'history' && !isCustomRangeIncomplete) ? `/sales/history?${buildHistoryParams()}` : null,
    swrFetcher,
    { keepPreviousData: true }
  );
  const historyItems: any[] = historyData?.items || [];
  const historyTotal: number = historyData?.total || 0;

  // --- Return History States ---
  const [returnHistoryPage, setReturnHistoryPage] = useState(1);
  const [returnHistoryPageSize, setReturnHistoryPageSize] = useState(25);
  
  const { data: returnHistoryData, mutate: mutateReturnHistory, isLoading: loadingReturnHistory } = useSWR(
    activeTab === 'return' ? `/sales/return-history?page=${returnHistoryPage}&page_size=${returnHistoryPageSize}` : null,
    swrFetcher
  );
  const returnHistoryItems: any[] = returnHistoryData?.items || [];
  const returnHistoryTotal: number = returnHistoryData?.total || 0;

  const [isReprintMode, setIsReprintMode] = useState(false);

  // --- In-flight guards (prevent duplicate sale/return submissions via double-click or F10) ---
  const completingSaleRef = useRef(false);
  const submittingReturnRef = useRef(false);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // --- KPIs ---
  const { data: kpiData, mutate: fetchKpis } = useSWR('/sales/kpi', swrFetcher);
  const kpis = kpiData || { todaysSales: 0, totalRevenue: 0, totalInvoices: 0, itemsSoldToday: 0, pendingPayments: 0 };
  
  const fetchHistory = mutateHistory;
  const fetchReturnHistory = mutateReturnHistory;

  // --- Initialization ---
  useEffect(() => {
    fetchInitData();
    fetchKpis();
    // Hotkeys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showShortcutsRef.current) return;
      if (e.key === "F1") { e.preventDefault(); toast.info("Help: Use F-keys for quick actions"); }
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === "F4") { e.preventDefault(); document.getElementById("customer-select")?.focus(); }
      if (e.key === "F5") { e.preventDefault(); toast("Sale Held temporarily."); }
      if (e.key === "F8") { e.preventDefault(); toast("Opening Recent Sales..."); }
      if (e.key === "F9") { 
        e.preventDefault(); 
        setCart([]); 
        setPaidAmount(0); 
        setInvoiceDiscountType("percent"); 
        setInvoiceDiscountValue(discountEnabled ? defaultDiscountRate : 0); 
        toast.success("Cart cleared"); 
      }
      if (e.key === "F10") { e.preventDefault(); document.getElementById("complete-sale-btn")?.click(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchInitData = async () => {
    try {
      setLoadingInit(true);
      const initRes = await apiClient.get('/sales/init');
      if (initRes.success && initRes.data) {
        setInvoiceNo(initRes.data.InvoiceNumber);
        setTaxRate(initRes.data.DefaultTaxRate);
        setMaxDiscount(initRes.data.MaxDiscountPercentage);
        setDiscountEnabled(initRes.data.DiscountEnabled);
        setRequireAdminPin(initRes.data.RequireAdminPinForDiscount ?? false);
        setAdminDiscountThreshold(initRes.data.AdminDiscountThreshold ?? 10);
        
        const defDiscount = initRes.data.DefaultDiscountRate ?? (initRes.data.DiscountEnabled ? (initRes.data.MaxDiscountPercentage <= 20 ? initRes.data.MaxDiscountPercentage : 0) : 0);
        setDefaultDiscountRate(defDiscount);
        if (initRes.data.DiscountEnabled && defDiscount > 0) {
          setInvoiceDiscountType("percent");
          setInvoiceDiscountValue(defDiscount);
        } else {
          setInvoiceDiscountValue(0);
        }
        
        // POS Behavior
        if (initRes.data.DefaultPaymentMethod) {
          setPaymentMethod(initRes.data.DefaultPaymentMethod);
        }
        autoPrintRef.current = initRes.data.AutoPrintReceipt ?? false;
        showShortcutsRef.current = initRes.data.ShowKeyboardShortcuts ?? true;
        setShowKeyboardShortcuts(initRes.data.ShowKeyboardShortcuts ?? true);
      }
      
      const printerRes = await apiClient.get<any>('/settings/printer');
      if (printerRes && !printerRes.error) {
        // Handle both wrapped and unwrapped responses just in case
        setPrinterSettings(printerRes.data || printerRes);
      }

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setSalesperson(user.FullName || user.Username || "Admin");
      }

      const custRes = await apiClient.get('/customers');
      if (custRes.success && custRes.data) {
        setCustomers(custRes.data);
      }
    } catch (err) {
      toast.error("Failed to initialize POS");
    } finally {
      setLoadingInit(false);
    }
  };

  // --- Search & Add ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async (q: string) => {
    setIsSearching(true);
    try {
      const res = await apiClient.get(`/sales/search-product?q=${encodeURIComponent(q)}`);
      if (res.success) {
        setSearchResults(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProduct = (product: ProductSearchResponse) => {
    if (!product.Batches || product.Batches.length === 0) {
      toast.error(`No stock available for ${product.MedicineName}`);
      return;
    }

    addToCart(product);
  };

  const addToCart = (product: ProductSearchResponse) => {
    let bestBatch = product.Batches[0];

    // Handle PreventSaleOfExpired
    if (inventorySettings.PreventSaleOfExpired) {
      const validBatches = product.Batches.filter(b => {
        if (!b.ExpiryDate) return true;
        const expiryDate = new Date(b.ExpiryDate);
        return expiryDate > new Date();
      });
      if (validBatches.length === 0) {
        toast.error(`Cannot add. All batches for ${product.MedicineName} are expired.`);
        return;
      }
      bestBatch = inventorySettings.EnableFefo ? validBatches[0] : validBatches[validBatches.length - 1];
    } else {
      bestBatch = inventorySettings.EnableFefo ? product.Batches[0] : product.Batches[product.Batches.length - 1];
    }

    const uniqueId = `${product.MedicineId}-${bestBatch.BatchId}`;
    lastAddedIdRef.current = uniqueId;

    setCart(prev => {
      const existing = prev.find(i => i.id === uniqueId);
      if (existing) {
        if (existing.Quantity + 1 > existing.AvailableStock && !inventorySettings.AllowNegativeStock) {
          toast.error(`Cannot add more. Only ${existing.AvailableStock} in stock.`);
          return prev;
        }
        return prev.map(i =>
          i.id === uniqueId
            ? { ...i, Quantity: i.Quantity + 1, LineTotal: calculateLineTotal(i.Quantity + 1, i.UnitPrice) }
            : i
        );
      }

      return [...prev, {
        id: uniqueId,
        MedicineId: product.MedicineId,
        MedicineName: product.MedicineName,
        BatchId: bestBatch.BatchId,
        BatchCode: bestBatch.BatchCode,
        ExpiryDate: bestBatch.ExpiryDate,
        AvailableStock: bestBatch.AvailableStock,
        UnitPrice: bestBatch.UnitPrice,
        Quantity: 1,
        Discount: discountEnabled ? maxDiscount : 0,
        TaxPercent: taxRate,
        LineTotal: calculateLineTotal(1, bestBatch.UnitPrice),
        RequiresPrescription: product.RequiresPrescription
      }];
    });

    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchIdx(-1);
    toast.success(`Added ${product.MedicineName}`);

    // Focus qty input of the newly added item after render
    setTimeout(() => {
      const qtyEl = qtyInputRefs.current[uniqueId];
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  };

  const calculateLineTotal = (qty: number, price: number) => {
    return qty * price;
  };

  const updateCartItem = (id: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate if qty, discount, or tax changed
        if (['Quantity', 'Discount', 'TaxPercent'].includes(field)) {
          if (field === 'Quantity') {
            if (value > item.AvailableStock && !inventorySettings.AllowNegativeStock) {
              toast.error(`Only ${item.AvailableStock} units available in this batch.`);
              updated.Quantity = item.AvailableStock;
            }
            if (updated.Quantity < 1) updated.Quantity = 1;
          }
          updated.LineTotal = calculateLineTotal(updated.Quantity, updated.UnitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  // --- Calculations ---
  const subtotal = cart.reduce((sum, item) => sum + (item.Quantity * item.UnitPrice), 0);
  
  let totalDiscount = 0;
  if (discountEnabled) {
    if (invoiceDiscountType === "percent") {
      totalDiscount = subtotal * ((invoiceDiscountValue || 0) / 100);
    } else {
      totalDiscount = invoiceDiscountValue || 0;
    }
    if (totalDiscount > subtotal) totalDiscount = subtotal;
  }
  
  const discountedSubtotal = subtotal - totalDiscount;
  const totalTax = discountedSubtotal * ((taxRate || 0) / 100);
  const grandTotal = discountedSubtotal + totalTax;
  const totalItemsCount = cart.length;
  const totalQtyCount = cart.reduce((sum, item) => sum + item.Quantity, 0);
  const changeDue = Math.max(0, paidAmount - grandTotal);
  const remainingBalance = Math.max(0, grandTotal - paidAmount);

  // Auto-fill paid amount to grand total when cart changes (keeps it up to date)
  useEffect(() => {
    if (cart.length > 0) {
      setPaidAmount(grandTotal);
    } else {
      setPaidAmount(0);
    }
  }, [grandTotal]);

  // Note-based Quick Payment Presets
  // Pakistani currency notes: 10, 20, 50, 100, 500, 1000, 5000
  const paymentPresets = useCallback(() => {
    if (grandTotal <= 0) return [];

    const notes = [10, 20, 50, 100, 500, 1000, 5000];
    const result = new Set<number>();

    // 1. Always include exact bill
    result.add(grandTotal);

    // 2. Nearest rounded-up amounts (practical change-giving)
    const roundTo50  = Math.ceil(grandTotal / 50)  * 50;
    const roundTo100 = Math.ceil(grandTotal / 100) * 100;
    if (roundTo50  > grandTotal) result.add(roundTo50);
    if (roundTo100 > grandTotal) result.add(roundTo100);

    // 3. Note denominations strictly above the bill
    for (const note of notes) {
      if (note > grandTotal) result.add(note);
    }

    return Array.from(result).sort((a, b) => a - b).slice(0, 5);
  }, [grandTotal]);

  const verifyAdminPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/auth/verify-pin', { pin: adminPinInput });
      if (res.success) {
        setIsAdminPinModalOpen(false);
        setAdminPinInput("");
        handleCompleteSale(true);
      } else {
        toast.error(res.error || "Invalid Admin PIN/Password");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid Admin PIN/Password");
    }
  };

  const handleCompleteSale = async (skipPinCheck: boolean | React.MouseEvent = false) => {
    const isSkip = typeof skipPinCheck === 'boolean' ? skipPinCheck : false;
    if (completingSaleRef.current) return;
    if (cart.length === 0) return;

    // Auto-fill exact amount if user didn't enter anything for non-credit sales
    let finalPaidAmount = paidAmount;
    if (paidAmount === 0 && paymentMethod !== 'Credit') {
      finalPaidAmount = grandTotal;
      setPaidAmount(grandTotal);
    }

    if (finalPaidAmount < grandTotal && selectedCustomerId === 'walkin') {
      toast.error("Credit sales are not allowed for Walk-in Customers. Please select or register a customer.");
      return;
    }

    if (discountEnabled && maxDiscount > 0) {
      const discountPct = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;
      if (discountPct > maxDiscount + 0.01) {
        toast.error(`Discount (${discountPct.toFixed(1)}%) exceeds maximum allowed limit of ${maxDiscount}%`);
        return;
      }
    }

    if (!isSkip && requireAdminPin) {
      const discountPct = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;
      const needsPin = discountPct > adminDiscountThreshold;
      if (needsPin) {
        setIsAdminPinModalOpen(true);
        return;
      }
    }

    try {
      completingSaleRef.current = true;
      setIsCompletingSale(true);
      const payload = {
        CustomerId: selectedCustomerId === 'walkin' ? null : parseInt(selectedCustomerId),
        SubTotal: subtotal,
        DiscountAmount: totalDiscount,
        TaxAmount: totalTax,
        GrandTotal: grandTotal,
        PaidAmount: finalPaidAmount,
        PaymentMethod: paymentMethod,
        Items: cart.map(item => ({
          MedicineId: item.MedicineId,
          BatchId: item.BatchId,
          Quantity: item.Quantity,
          UnitPrice: item.UnitPrice,
          Discount: 0,
          TaxPercent: 0,
          LineTotal: item.LineTotal,
          RequiresPrescription: item.RequiresPrescription,
        }))
      };

      const res = await apiClient.post('/sales', payload);
      if (res.success) {
        toast.success(`Sale completed! Invoice: ${res.data.InvoiceNumber}`);

        // Populate Receipt Data
        setCompletedReceipt({
          InvoiceNumber: res.data.InvoiceNumber,
          SalesId: res.data.SalesId,
          Date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          Cashier: salesperson,
          CustomerName: selectedCustomerName,
          Items: cart,
          SubTotal: subtotal,
          Discount: totalDiscount,
          Tax: totalTax,
          GrandTotal: grandTotal,
          PaidAmount: finalPaidAmount,
          ChangeDue: Math.max(0, finalPaidAmount - grandTotal)
        });

        setCart([]);
        setPaidAmount(0);
        setInvoiceDiscountType("percent");
        setInvoiceDiscountValue(discountEnabled ? defaultDiscountRate : 0);
        setSelectedCustomerId("walkin");
        setCustomerSearchQuery("");
        fetchInitData(); // get next invoice number
        fetchKpis(); // update KPIs
      } else {
        toast.error(res.error || "Failed to complete sale");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during checkout");
    } finally {
      completingSaleRef.current = false;
      setIsCompletingSale(false);
    }
  };

  const handleThermalPrint = async (isRetry = false): Promise<boolean> => {
    if (!completedReceipt) return false;
    if (isRetry) setIsPrintRetrying(true);
    try {
      let endpoint: string;
      if (completedReceipt.type === 'return' && completedReceipt.ReturnId) {
        endpoint = `/sales/return/${completedReceipt.ReturnId}/print-thermal`;
      } else if (completedReceipt.SalesId && completedReceipt.SalesId > 0) {
        endpoint = `/sales/${completedReceipt.SalesId}/print-thermal`;
      } else {
        toast.error("No printer job available for this receipt");
        return false;
      }

      const res = await apiClient.post(endpoint, {}, {
        params: completedReceipt.type === 'return' ? {} : { is_reprint: String(isReprintMode || autoPrintRef.current) }
      });

      if (res.success) {
        toast.success("Receipt sent to thermal printer");
        return true;
      } else {
        const errMsg = res.error || "Thermal print failed";
        toast.error(errMsg, {
          action: {
            label: "Retry Print",
            onClick: () => handleThermalPrint(true)
          },
          duration: 8000
        });
        return false;
      }
    } catch (err: any) {
      const errMsg = err.message || "Thermal print failed";
      toast.error(errMsg, {
        action: {
          label: "Retry Print",
          onClick: () => handleThermalPrint(true)
        },
        duration: 8000
      });
      return false;
    } finally {
      if (isRetry) setIsPrintRetrying(false);
    }
  };

  const handlePrintReceipt = () => {
    const printContent = document.getElementById("print-area");
    if (!printContent) return;

    const paperWidth = printerSettings?.PaperSize === "58mm" ? "58mm" : "80mm";
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = paperWidth;
    iframe.style.height = "100vh";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt</title>
            <style>
              @page { 
                margin: 0;
                size: ${printerSettings?.PaperSize === "58mm" ? "58mm" : "80mm"} auto;
              }
              html, body { 
                margin: 0 !important; 
                padding: 0 !important;
                width: ${printerSettings?.PaperSize === "58mm" ? "58mm" : "80mm"};
                height: auto !important;
                background: white;
                color: black;
                font-family: monospace;
                font-size: ${Math.round(12 * (printerSettings?.FontScale || 100) / 100)}px;
              }
              
              /* Tailwind Utility Classes */
              * { box-sizing: border-box; }
              .p-6 { padding: 10px; } /* Reduced padding for thermal */
              .w-full { width: 100%; }
              .max-w-\\[80mm\\] { max-width: 80mm; }
              .text-black { color: #000; }
              .font-mono { font-family: monospace; }
              .text-xs { font-size: 12px; line-height: 1.2; }
              .text-sm { font-size: 14px; line-height: 1.2; }
              .text-base { font-size: 16px; line-height: 1.2; }
              .text-4xl { font-size: 24px; line-height: 1.2; }
              .text-\\[10px\\] { font-size: 10px; line-height: 1.2; }
              .text-gray-500 { color: #6b7280; }
              .text-slate-900, .dark\\:text-slate-100 { color: #000; }
              
              .relative { position: relative; }
              .absolute { position: absolute; }
              .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
              .z-10 { z-index: 10; }
              
              .pointer-events-none { pointer-events: none; }
              .overflow-hidden { overflow: hidden; }
              .opacity-10 { opacity: 0.1; }
              
              .flex { display: flex; }
              .items-center { align-items: center; }
              .items-start { align-items: flex-start; }
              .justify-center { justify-content: center; }
              .justify-between { justify-content: space-between; }
              .flex-1 { flex: 1 1 0%; }
              .flex-\\[2\\] { flex: 2 2 0%; }
              
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .font-bold { font-weight: 700; }
              .font-semibold { font-weight: 600; }
              .uppercase { text-transform: uppercase; }
              .whitespace-nowrap { white-space: nowrap; }
              .break-words { word-break: break-word; }
              .leading-tight { line-height: 1.25; }
              
              .transform { transform: translate(0); }
              .-rotate-45 { transform: rotate(-45deg); }
              
              .mb-1 { margin-bottom: 0.25rem; }
              .mb-2 { margin-bottom: 0.5rem; }
              .mb-4 { margin-bottom: 1rem; }
              .mb-6 { margin-bottom: 1.5rem; }
              .pb-1 { padding-bottom: 0.25rem; }
              .pb-2 { padding-bottom: 0.5rem; }
              .pt-2 { padding-top: 0.5rem; }
              .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
              .pr-1 { padding-right: 0.25rem; }
              
              .space-y-1 > :not([hidden]) ~ :not([hidden]) {
                margin-top: 0.25rem;
                margin-bottom: 0;
              }
              
              .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
              .border-t { border-top-width: 1px; border-top-style: solid; }
              .border-y { border-top-width: 1px; border-bottom-width: 1px; border-top-style: solid; border-bottom-style: solid; }
              .border-dashed { border-style: dashed; }
              .border-gray-400 { border-color: #9ca3af; }
              .border-black { border-color: #000; }
              
              .w-12 { width: 3rem; }
              .h-12 { height: 3rem; }
              .object-contain { object-fit: contain; }
              .grayscale { filter: grayscale(100%); }
            </style>
          </head>
          <body>
            ${printContent.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      // Wait for fonts and images to load
      setTimeout(() => {
        if (doc.body) {
          iframe.style.height = doc.body.scrollHeight + 'px';
        }
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Cleanup after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  useEffect(() => {
    if (completedReceipt && autoPrintRef.current) {
      autoPrintRef.current = false;
      setTimeout(() => {
        handleThermalPrint();
      }, 500);
    }
  }, [completedReceipt]);

  // --- Sales Return Logic ---
  const handleFetchReturnInvoice = async () => {
    if (!returnInvoiceNo.trim()) return toast.error("Enter an invoice number");
    try {
      const res = await apiClient.get(`/sales/invoice/${returnInvoiceNo.trim()}`);
      if (res.success && res.data) {
        setReturnInvoiceData(res.data);
        setReturnItems(res.data.Items.map((item: any) => ({
          ...item,
          ReturnQuantity: 0,
          ReturnReason: '',
          ItemCondition: 'Restockable'
        })));
      }
    } catch (err: any) {
      toast.error(err.message || "Invoice not found");
      setReturnInvoiceData(null);
    }
  };

  const updateReturnItem = (salesItemId: number, field: string, value: any) => {
    setReturnItems(prev => prev.map(item => {
      if (item.SalesItemId === salesItemId) {
        let val = value;
        if (field === 'ReturnQuantity') {
          const maxRet = item.Quantity - item.ReturnedQuantity;
          if (val > maxRet) {
            val = maxRet;
            toast.error(`Cannot return more than ${maxRet}`);
          }
          if (val < 0) val = 0;
        }
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  const totalRefundPreview = returnItems.reduce((sum, item) => {
    if (item.ReturnQuantity <= 0) return sum;
    const unitRefund = item.Quantity > 0 ? (item.TotalPrice / item.Quantity) : item.UnitPrice;
    return sum + (unitRefund * item.ReturnQuantity);
  }, 0);

  const handleSubmitReturn = async () => {
    if (submittingReturnRef.current) return;
    const itemsToReturn = returnItems.filter(i => i.ReturnQuantity > 0);
    if (itemsToReturn.length === 0) return toast.error("Select at least one item to return");

    const missingReason = itemsToReturn.find(i => !i.ReturnReason);
    if (missingReason) return toast.error(`Select a return reason for ${missingReason.MedicineName}`);

    const reasons = [...new Set(itemsToReturn.map(i => i.ReturnReason).filter(Boolean))];
    const combinedReason = reasons.join('; ');

    try {
      submittingReturnRef.current = true;
      setIsSubmittingReturn(true);
      const payload = {
        InvoiceNumber: returnInvoiceData.InvoiceNumber,
        Reason: combinedReason,
        RefundMode: refundMode,
        Items: itemsToReturn.map(i => ({
          SalesItemId: i.SalesItemId,
          BatchId: i.BatchId,
          ReturnQuantity: i.ReturnQuantity,
          ItemCondition: i.ItemCondition,
          ReturnReason: i.ReturnReason
        }))
      };
      const res = await apiClient.post('/sales/return', payload);
      if (res.success) {
        toast.success(`Return Processed! Refund: ${formatCurrency(res.data.RefundAmount)}`);
        setReturnInvoiceData(null);
        setReturnInvoiceNo("");
        setReturnItems([]);
        setRefundMode("Cash Refund");
        fetchReturnHistory();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      submittingReturnRef.current = false;
      setIsSubmittingReturn(false);
    }
  };



  const handlePrintReturn = async (returnId: number) => {
    try {
      const res = await apiClient.get(`/sales/return/${returnId}`);
      if (res.success && res.data) {
        setIsReprintMode(true);
        setCompletedReceipt({
          type: 'return',
          ReturnId: returnId,
          InvoiceNumber: res.data.ReturnInvoiceNumber,
          SalesId: 0,
          Date: res.data.ReturnDate,
          Cashier: res.data.CashierName,
          Items: res.data.Items.map((i: any, index: number) => ({
            id: index,
            MedicineName: i.MedicineName,
            BatchCode: i.BatchCode,
            ExpiryDate: "",
            Quantity: i.ReturnQuantity,
            UnitPrice: i.RefundAmount / (i.ReturnQuantity || 1),
            LineTotal: i.RefundAmount
          })),
          SubTotal: res.data.TotalRefundAmount,
          Discount: 0,
          GrandTotal: res.data.TotalRefundAmount,
          PaidAmount: res.data.TotalRefundAmount,
          ChangeDue: 0
        });
      }
    } catch (err) {
      toast.error("Failed to fetch return details for printing");
    }
  };

  const handleViewReturn = async (returnId: number) => {
    try {
      const res = await apiClient.get(`/sales/return/${returnId}`);
      if (res.success && res.data) {
        setIsReprintMode(false);
        setCompletedReceipt({
          type: 'return',
          ReturnId: returnId,
          InvoiceNumber: res.data.ReturnInvoiceNumber,
          SalesId: 0,
          Date: res.data.ReturnDate,
          Cashier: res.data.CashierName,
          Items: res.data.Items.map((i: any, index: number) => ({
            id: index,
            MedicineName: i.MedicineName,
            BatchCode: i.BatchCode,
            ExpiryDate: "",
            Quantity: i.ReturnQuantity,
            UnitPrice: i.RefundAmount / (i.ReturnQuantity || 1),
            LineTotal: i.RefundAmount
          })),
          SubTotal: res.data.TotalRefundAmount,
          Discount: 0,
          GrandTotal: res.data.TotalRefundAmount,
          PaidAmount: res.data.TotalRefundAmount,
          ChangeDue: 0
        });
      }
    } catch (err) {
      toast.error("Failed to fetch return details");
    }
  };

  // --- Sales History Logic ---


  const exportCSV = () => {
    if (historyItems.length === 0) return toast.error("No data to export");
    const headers = ["Date", "Invoice No", "Customer", "Total Amount", "Paid Amount", "Balance Due", "Status"];
    const rows = historyItems.map(item => [
      item.TransactionDate,
      item.InvoiceNumber,
      item.CustomerName || "Walk-in",
      item.GrandTotal.toString(),
      item.PaidAmount.toString(),
      (item.GrandTotal - item.PaidAmount).toString(),
      item.Status
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  const exportPDF = () => {
    if (historyItems.length === 0) return toast.error("No data to export");
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('Sales History Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB').replaceAll('/', '-')} ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true})}`, 14, 30);
    
    const tableColumn = ["Date & Time", "Invoice No.", "Customer", "Total Amount", "Paid", "Balance Due", "Status"];
    const tableRows = historyItems.map(item => [
      item.TransactionDate,
      item.InvoiceNumber,
      item.CustomerName || "Walk-in",
      `${formatCurrency(item.GrandTotal)}`,
      `${formatCurrency(item.PaidAmount)}`,
      `${formatCurrency(Math.max(0, item.GrandTotal - item.PaidAmount))}`,
      item.Status
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 36,
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right', textColor: [16, 185, 129] },
        5: { halign: 'right' },
        6: { halign: 'center' }
      }
    });

    const filename = `sales_history_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    toast.success("PDF downloaded successfully");
  };



  const handleReprint = async (invoiceNo: string, cashierName: string, paymentMethod: string) => {
    try {
      const res = await apiClient.get(`/sales/invoice/${invoiceNo}`);
      if (res.success && res.data) {
        setIsReprintMode(true);
        setCompletedReceipt({
          InvoiceNumber: res.data.InvoiceNumber,
          SalesId: res.data.SalesId,
          Date: res.data.TransactionDate,
          Cashier: cashierName,
          CustomerName: res.data.CustomerName || "Walk-in Customer",
          Items: res.data.Items.map((i: any) => ({
            id: i.SalesItemId,
            MedicineName: i.MedicineName,
            BatchCode: i.BatchCode,
            ExpiryDate: "",
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice,
            LineTotal: i.TotalPrice
          })),
          SubTotal: res.data.SubTotal,
          Discount: res.data.DiscountAmount,
          GrandTotal: res.data.GrandTotal,
          PaidAmount: res.data.GrandTotal,
          ChangeDue: 0
        });
      }
    } catch (err) {
      toast.error("Failed to fetch invoice for reprint");
    }
  };

  const handleView = async (invoiceNo: string, cashierName: string) => {
    try {
      const res = await apiClient.get(`/sales/invoice/${invoiceNo}`);
      if (res.success && res.data) {
        setIsReprintMode(false);
        setCompletedReceipt({
          InvoiceNumber: res.data.InvoiceNumber,
          SalesId: res.data.SalesId,
          Date: res.data.TransactionDate,
          Cashier: cashierName,
          CustomerName: res.data.CustomerName || "Walk-in Customer",
          Items: res.data.Items.map((i: any) => ({
            id: i.SalesItemId,
            MedicineName: i.MedicineName,
            BatchCode: i.BatchCode,
            ExpiryDate: "",
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice,
            LineTotal: i.TotalPrice
          })),
          SubTotal: res.data.SubTotal,
          Discount: res.data.DiscountAmount,
          GrandTotal: res.data.GrandTotal,
          PaidAmount: res.data.GrandTotal,
          ChangeDue: 0
        });
      }
    } catch (err) {
      toast.error("Failed to fetch invoice details");
    }
  };

  const buildSaleChallanData = async (invoiceNo: string): Promise<ChallanData | null> => {
    try {
      const res = await apiClient.get<any>(`/sales/invoice/${invoiceNo}`);
      if (res.success === false || !res.data) return null;

      const d = res.data;
      return {
        type: "sale",
        ChallanNumber: d.InvoiceNumber,
        Date: d.TransactionDate || new Date().toLocaleDateString(),
        FromName: profile.PharmacyName || "Pharmacy",
        FromAddress: [profile.Address, profile.City].filter(Boolean).join(", "),
        FromPhone: profile.PhoneNumber || "",
        FromLicense: profile.DrugLicenseNumber || undefined,
        ToName: d.CustomerName || "Walk-in Customer",
        ToAddress: undefined,
        ToPhone: undefined,
        Items: (d.Items || []).map((i: any) => ({
          MedicineName: i.MedicineName,
          BatchCode: i.BatchCode,
          ExpiryDate: i.ExpiryDate || undefined,
          Quantity: i.Quantity,
          UnitPrice: i.UnitPrice,
          Discount: i.Discount || 0,
          Tax: i.Tax || 0,
          LineTotal: i.TotalPrice,
        })),
        SubTotal: d.SubTotal || 0,
        DiscountAmount: d.DiscountAmount || 0,
        TaxAmount: d.TaxAmount || 0,
        GrandTotal: d.GrandTotal || 0,
        PaidAmount: d.PaidAmount ?? d.GrandTotal,
        PaymentMethod: d.PaymentMethod || undefined,
      };
    } catch {
      toast.error("Failed to load challan data");
      return null;
    }
  };

  const [challanDataMap, setChallanDataMap] = useState<Record<string, ChallanData | null>>({});

  const handleChallanClick = async (invoiceNo: string) => {
    if (!challanDataMap[invoiceNo]) {
      const data = await buildSaleChallanData(invoiceNo);
      if (data) setChallanDataMap(prev => ({ ...prev, [invoiceNo]: data }));
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50 dark:bg-background relative">
      <div className="flex-1 p-4 lg:p-6 pb-6">

        {/* Header */}
        <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales & POS Billing</h1>
            <p className="text-sm text-muted-foreground mt-1">Process medicine sales, generate invoices, accept payments.</p>
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



        {/* Action Tabs */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-border mb-6">
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto custom-scrollbar">
            <button 
              onClick={() => onTabChange("pos")} 
              className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap", activeTab === 'pos' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
            >
              New Sale (POS)
            </button>
            <button 
              onClick={() => onTabChange("history")} 
              className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap", activeTab === 'history' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
            >
              Sales History
            </button>
            <button 
              onClick={() => onTabChange("return")} 
              className={cn("px-6 py-2.5 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap", activeTab === 'return' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50")}
            >
              Sales Return
            </button>
          </div>
        </div>

        {/* POS Grid */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Middle Column (Search & Cart) */}
            <div className="lg:col-span-9 space-y-6 flex flex-col">

              {/* ── 1. Select Customer ── */}
              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-4 relative z-30">
                <h3 className="font-semibold text-foreground mb-3 flex items-center justify-between">
                  <span>1. Select Customer</span>
                  {selectedCustomerId !== "walkin" && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomerId("walkin"); setCustomerSearchQuery(""); setShowCustomerDropdown(false); }}
                      className="text-xs text-muted-foreground hover:text-rose-500 transition-colors"
                    >
                      ✕ Clear
                    </button>
                  )}
                </h3>
                <div className="relative">
                  <div className={cn(
                    "flex items-center gap-2 rounded-lg border transition-all",
                    showCustomerDropdown ? "border-primary ring-1 ring-primary/30" : "border-input",
                    selectedCustomerId !== "walkin" && !showCustomerDropdown
                      ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700"
                      : ""
                  )}>
                    <User className="w-4 h-4 text-muted-foreground ml-3 shrink-0" />
                    <input
                      id="customer-select"
                      ref={customerSearchInputRef}
                      type="text"
                      className={cn(
                        "flex-1 bg-transparent border-none outline-none text-sm py-2.5 pr-2 text-foreground placeholder:text-muted-foreground min-w-0",
                        !showCustomerDropdown && "cursor-pointer select-none"
                      )}
                      placeholder="Walk-in Customer"
                      value={showCustomerDropdown ? customerSearchQuery : (selectedCustomerId === "walkin" ? "Walk-in Customer" : selectedCustomerName)}
                      readOnly={!showCustomerDropdown}
                      onFocus={() => { setShowCustomerDropdown(true); setCustomerSearchQuery(""); }}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 180)}
                      onChange={e => setCustomerSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === "Escape") { setShowCustomerDropdown(false); setCustomerSearchQuery(""); (e.target as HTMLInputElement).blur(); } }}
                    />
                    {selectedCustomerId !== "walkin" && !showCustomerDropdown && (
                      <span className="mr-2 inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700 shrink-0">
                        <User className="w-2.5 h-2.5" />
                        Registered
                      </span>
                    )}
                  </div>

                  {/* Customer dropdown */}
                  {showCustomerDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
                      {/* Walk-in option */}
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-border",
                          selectedCustomerId === "walkin" ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-secondary/30"
                        )}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setSelectedCustomerId("walkin"); setCustomerSearchQuery(""); setShowCustomerDropdown(false); customerSearchInputRef.current?.blur(); }}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Walk-in Customer</p>
                          <p className="text-xs text-muted-foreground">No account — cash sale</p>
                        </div>
                        {selectedCustomerId === "walkin" && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>

                      {/* Registered customer list */}
                      <div className="max-h-52 overflow-y-auto custom-scrollbar">
                        {(() => {
                          const q = customerSearchQuery.trim().toLowerCase();
                          const filtered = q
                            ? customers.filter((c: any) =>
                                c.Name?.toLowerCase().includes(q) ||
                                c.Phone?.toLowerCase().includes(q)
                              )
                            : customers;
                          if (filtered.length === 0 && q) {
                            return (
                              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                No customers found for &ldquo;{customerSearchQuery}&rdquo;
                              </div>
                            );
                          }
                          if (customers.length === 0) {
                            return (
                              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                No registered customers yet.
                              </div>
                            );
                          }
                          return filtered.map((c: any) => (
                            <div
                              key={c.CustomerId}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                                selectedCustomerId === String(c.CustomerId)
                                  ? "bg-blue-50 dark:bg-blue-900/20"
                                  : "hover:bg-secondary/30"
                              )}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setSelectedCustomerId(String(c.CustomerId)); setCustomerSearchQuery(""); setShowCustomerDropdown(false); customerSearchInputRef.current?.blur(); }}
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                                <span className="text-white text-[10px] font-bold">{c.Name?.charAt(0)?.toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{c.Name}</p>
                                {c.Phone && <p className="text-xs text-muted-foreground">{c.Phone}</p>}
                              </div>
                              {selectedCustomerId === String(c.CustomerId) && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Add new customer shortcut */}
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-border transition-colors"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setShowCustomerDropdown(false); setCustomerSearchQuery(""); setIsAddCustomerOpen(true); }}
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">Add New Customer</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-4 relative z-20">
                <h3 className="font-semibold text-foreground mb-3 flex justify-between items-center">
                  2. Search Medicine
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    autoFocus
                    placeholder="Search medicine by name, barcode, or code..."
                    className="pl-9 pr-10 text-base py-6"
                    value={searchQuery}
                    onFocus={() => { setIsSearchFocused(true); handleSearch(searchQuery); }}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedSearchIdx(-1); }}
                    onKeyDown={e => {
                      if (searchResults.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedSearchIdx(i => Math.min(i + 1, searchResults.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedSearchIdx(i => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const idx = selectedSearchIdx >= 0 ? selectedSearchIdx : 0;
                        if (searchResults[idx]) handleSelectProduct(searchResults[idx]);
                      } else if (e.key === 'Escape') {
                        setSearchQuery(''); setSearchResults([]); setSelectedSearchIdx(-1);
                      }
                    }}
                  />
                  <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />

                  {/* Search Dropdown */}
                  {isSearchFocused && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto z-30">
                      {isSearching && searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Searching...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {searchQuery ? "No medicines found" : "Type to search medicines..."}
                        </div>
                      ) : (
                        <ul className={cn("divide-y divide-border", isSearching && "opacity-60")}>
                          {searchResults.map((res, idx) => {
                            const totalStock = res.Batches.reduce((sum, b) => sum + b.AvailableStock, 0);
                            const displayBatch = (inventorySettings?.EnableFefo ?? true) ? res.Batches[0] : res.Batches[res.Batches.length - 1];
                            const expiryStr = displayBatch.ExpiryDate ? new Date(displayBatch.ExpiryDate).toLocaleDateString() : "N/A";
                            return (
                              <li
                                key={res.MedicineId}
                                className={cn(
                                  "p-3 cursor-pointer transition-colors flex justify-between items-center",
                                  idx === selectedSearchIdx
                                    ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500"
                                    : "hover:bg-secondary/20"
                                )}
                                onMouseEnter={() => setSelectedSearchIdx(idx)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => handleSelectProduct(res)}
                              >
                                <div>
                                  <p className="font-medium text-foreground flex items-center gap-2">
                                    {res.MedicineName}
                                    {idx === selectedSearchIdx && <span className="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono">↵ select</span>}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{res.GenericName}</p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <div className="flex gap-4 mb-1">
                                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Rs {displayBatch.UnitPrice.toFixed(2)}</p>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Stock: {totalStock}</p>
                                  </div>
                                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Nearest Expiry: {expiryStr}</p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm flex-1 flex flex-col overflow-hidden relative z-10 min-h-[400px]">
                <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20">
                  <h3 className="font-semibold text-foreground">3. Sales Cart</h3>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                    <thead className="sticky top-0 z-10 bg-white dark:bg-card shadow-sm text-left">
                      <tr className="text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                        <th className="px-3 py-3 font-semibold">#</th>
                        <th className="px-3 py-3 font-semibold text-left">Medicine</th>
                        <th className="px-3 py-3 font-semibold text-left">Batch</th>
                        <th className="px-3 py-3 font-semibold text-center">Avail. Stock</th>
                        <th className="px-3 py-3 font-semibold text-center">Unit Price</th>
                        <th className="px-3 py-3 font-semibold text-center w-28">Qty</th>
                        <th className="px-3 py-3 font-semibold text-center">Line Total</th>
                        <th className="px-3 py-3 font-semibold text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border border-b border-border">
                      {cart.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-16 text-center">
                            <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground">Your cart is empty.</p>
                            <p className="text-xs text-muted-foreground mt-1">Search and select a medicine to begin.</p>
                          </td>
                        </tr>
                      ) : (
                        cart.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-3 py-3 text-muted-foreground text-center">{idx + 1}</td>
                            <td className="px-3 py-3 font-medium text-foreground text-left">
                              {item.MedicineName}

                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground text-left">{item.BatchCode}</td>
                            <td className="px-3 py-3 text-center text-muted-foreground text-xs">{item.AvailableStock}</td>
                            <td className="px-3 py-3 text-center">{formatCurrency(item.UnitPrice)}</td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center border border-input rounded-md overflow-hidden h-8">
                                <button onClick={() => updateCartItem(item.id, 'Quantity', item.Quantity - 1)} className="px-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">-</button>
                                <input
                                  type="number"
                                  ref={el => { qtyInputRefs.current[item.id] = el; }}
                                  className="w-10 text-center bg-transparent border-none focus:ring-0 text-sm h-full"
                                  value={item.Quantity}
                                  onChange={(e) => updateCartItem(item.id, 'Quantity', parseInt(e.target.value) || 1)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      // Refocus search for next item
                                      searchInputRef.current?.focus();
                                      searchInputRef.current?.select();
                                    }
                                  }}
                                />
                                <button onClick={() => updateCartItem(item.id, 'Quantity', item.Quantity + 1)} className="px-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">+</button>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-bold">{formatCurrency(item.LineTotal)}</td>
                            <td className="px-3 py-3 text-center">
                              <Button onClick={() => removeCartItem(item.id)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center text-sm text-muted-foreground">
                  <Button onClick={() => setCart([])} variant="outline" size="sm" className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/50">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear Cart
                  </Button>
                  <div className="flex gap-6">
                    <span>Total Items: <strong className="text-foreground">{totalItemsCount}</strong></span>
                    <span>Total Quantity: <strong className="text-foreground">{totalQtyCount}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Bill Summary) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-4 sticky top-6">
                <h3 className="font-semibold text-foreground mb-3">4. Bill Summary</h3>

                {/* Selected customer badge */}
                <div className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 mb-3 border text-sm",
                  selectedCustomerId !== "walkin"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                    : "bg-secondary/40 border-border text-muted-foreground"
                )}>
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium text-sm truncate">{selectedCustomerName}</span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Items</span>
                    <span className="font-medium text-foreground">{totalItemsCount}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                  </div>
                  {/* Discount & Tax in One Row */}
                  <div className="grid grid-cols-2 gap-2 pt-2 pb-1 border-t border-border/50">
                    {/* Discount Box */}
                    <div className={cn(
                      "bg-secondary/30 dark:bg-secondary/20 p-2 rounded-lg border border-border/60 flex flex-col justify-between gap-1.5",
                      !discountEnabled && "opacity-60"
                    )}>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-muted-foreground">
                          Discount {discountEnabled && invoiceDiscountValue > 0 ? (invoiceDiscountType === 'percent' ? `(${invoiceDiscountValue}%)` : `(${currencySymbol}${invoiceDiscountValue})`) : ''}
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 text-xs truncate">
                          -{formatCurrency(totalDiscount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex rounded border border-border bg-background p-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={!discountEnabled}
                            onClick={() => setInvoiceDiscountType("percent")}
                            className={cn(
                              "px-1.5 py-0.5 text-[11px] font-bold rounded transition-all",
                              invoiceDiscountType === "percent"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground",
                              !discountEnabled && "cursor-not-allowed opacity-50"
                            )}
                            title="Percent (%)"
                          >
                            %
                          </button>
                          <button
                            type="button"
                            disabled={!discountEnabled}
                            onClick={() => setInvoiceDiscountType("fixed")}
                            className={cn(
                              "px-1.5 py-0.5 text-[11px] font-bold rounded transition-all",
                              invoiceDiscountType === "fixed"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground",
                              !discountEnabled && "cursor-not-allowed opacity-50"
                            )}
                            title={`Fixed (${currencySymbol})`}
                          >
                            {currencySymbol}
                          </button>
                        </div>
                        <Input
                          id="invoice-discount-input"
                          type="number"
                          disabled={!discountEnabled}
                          min="0"
                          max={invoiceDiscountType === "percent" ? (maxDiscount > 0 ? Math.min(100, maxDiscount) : 100) : subtotal}
                          step="any"
                          placeholder="0"
                          value={!discountEnabled ? "0" : (invoiceDiscountValue === 0 ? "" : invoiceDiscountValue)}
                          onChange={(e) => {
                            if (!discountEnabled) return;
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            if (invoiceDiscountType === "percent" && val > 100) {
                              setInvoiceDiscountValue(100);
                            } else {
                              setInvoiceDiscountValue(val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('invoice-tax-input')?.focus();
                            }
                          }}
                          className="h-7 text-right font-semibold text-xs flex-1 min-w-0 bg-background px-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    {/* Tax Box */}
                    <div className="bg-secondary/30 dark:bg-secondary/20 p-2 rounded-lg border border-border/60 flex flex-col justify-between gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-muted-foreground">Tax ({taxRate}%)</span>
                        <span className="font-bold text-foreground text-xs truncate">
                          +{formatCurrency(totalTax)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center justify-center px-2 h-7 rounded border border-border bg-background text-[11px] font-bold text-muted-foreground shrink-0">
                          %
                        </div>
                        <Input
                          id="invoice-tax-input"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="0"
                          value={taxRate === 0 ? "" : taxRate}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setTaxRate(Math.min(100, val));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('paid-amount-input')?.focus();
                            }
                          }}
                          className="h-7 text-right font-semibold text-xs flex-1 min-w-0 bg-background px-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-border my-4 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">Grand Total</span>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>

                  <div className="space-y-3 bg-secondary/30 p-3 rounded-lg border border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-muted-foreground">Paid Amount</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-medium">{currencySymbol} </span>
                        <Input
                          id="paid-amount-input"
                          type="number"
                          className="w-24 h-9 font-bold text-right"
                          value={paidAmount || ""}
                          onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('complete-sale-btn')?.click();
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Quick Payment Presets */}
                    {cart.length > 0 && paymentPresets().length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {paymentPresets().map((preset, i) => (
                          <button
                            key={preset}
                            onClick={() => setPaidAmount(preset)}
                            className={cn(
                              "flex-1 min-w-[60px] text-xs font-bold py-1.5 px-2 rounded-lg border transition-all duration-150",
                              paidAmount === preset
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : preset === grandTotal
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
                                  : "bg-white dark:bg-secondary text-foreground border-border hover:bg-secondary/50"
                            )}
                          >
                            {currencySymbol} {Number.isInteger(preset) ? preset.toLocaleString() : preset.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">Change Due</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-500 text-lg">{formatCurrency(changeDue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-rose-600 dark:text-rose-500">Remaining Bal.</span>
                      <span className="font-bold text-rose-600 dark:text-rose-500">{formatCurrency(remainingBalance)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button id="complete-sale-btn" onClick={handleCompleteSale} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-500/20" disabled={cart.length === 0 || isCompletingSale}>
                    Complete Sale <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button variant="outline" onClick={() => { toast("Sale held temporarily. Cart preserved."); }} className="w-full h-11 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 font-medium">
                    <Pause className="mr-2 w-4 h-4" /> Hold Sale
                  </Button>
                  <Button variant="outline" onClick={() => { setCart([]); setPaidAmount(0); setInvoiceDiscountType("percent"); setInvoiceDiscountValue(discountEnabled ? defaultDiscountRate : 0); }} className="w-full h-11 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 font-medium">
                    <Trash2 className="mr-2 w-4 h-4" /> Clear Cart
                  </Button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Sales Return Grid */}
        {activeTab === 'return' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold mb-4 text-rose-600 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Process Sales Return</h2>
            <div className="flex gap-4 mb-6 items-end">
              <div className="max-w-xs flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5" /> Invoice No. or Scan Barcode
                </label>
                <Input
                  autoFocus
                  placeholder="INV-2608-0001"
                  value={returnInvoiceNo}
                  onChange={(e) => setReturnInvoiceNo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetchReturnInvoice(); } }}
                  className="uppercase font-mono"
                />
              </div>
              <Button onClick={handleFetchReturnInvoice} className="bg-slate-800 text-white hover:bg-slate-900 shadow h-10">
                <Search className="w-4 h-4 mr-2" /> Lookup Invoice
              </Button>
            </div>

            {returnInvoiceData && (
              <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center bg-secondary/30 p-4 rounded-lg border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-bold text-foreground">{returnInvoiceData.CustomerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Original Date</p>
                    <p className="font-bold text-foreground">{returnInvoiceData.TransactionDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Grand Total</p>
                    <p className="font-bold text-foreground">{formatCurrency(returnInvoiceData.GrandTotal)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                    <thead className="bg-secondary/50 border-b border-border text-left">
                      <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                        <th className="px-3 py-3 font-semibold">Medicine Name</th>
                        <th className="px-3 py-3 font-semibold text-left">Batch No.</th>
                        <th className="px-3 py-3 font-semibold text-center">Sold Price</th>
                        <th className="px-3 py-3 font-semibold text-center">Sold Qty</th>
                        <th className="px-3 py-3 font-semibold text-center w-24">Return Qty</th>
                        <th className="px-3 py-3 font-semibold w-52 text-left">Return Reason</th>
                        <th className="px-3 py-3 font-semibold text-center">Refund Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border border-b border-border">
                      {returnItems.map(item => {
                        const maxReturnable = item.Quantity - item.ReturnedQuantity;
                        const isFullyReturned = maxReturnable === 0;
                        const unitRefund = item.Quantity > 0 ? (item.TotalPrice / item.Quantity) : item.UnitPrice;
                        const refund = unitRefund * item.ReturnQuantity;

                        return (
                          <tr key={item.SalesItemId} className={isFullyReturned ? "opacity-50 bg-secondary/20" : "hover:bg-secondary/10"}>
                            <td className="px-3 py-3 font-medium text-foreground text-left">{item.MedicineName}</td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground text-left">{item.BatchCode}</td>
                            <td className="px-3 py-3 text-center">{formatCurrency(item.UnitPrice)}</td>
                            <td className="px-3 py-3 text-center">{item.Quantity}</td>
                            <td className="px-3 py-3 text-center">
                              <Input
                                type="number"
                                disabled={isFullyReturned}
                                min={0}
                                max={maxReturnable}
                                value={item.ReturnQuantity === 0 ? "" : item.ReturnQuantity}
                                onChange={(e) => updateReturnItem(item.SalesItemId, 'ReturnQuantity', parseInt(e.target.value) || 0)}
                                className="w-16 text-center h-8 mx-auto"
                              />
                            </td>
                            <td className="px-3 py-3 text-left">
                              <select
                                disabled={isFullyReturned || item.ReturnQuantity === 0}
                                value={item.ReturnReason}
                                onChange={(e) => updateReturnItem(item.SalesItemId, 'ReturnReason', e.target.value)}
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                              >
                                <option value="">Select reason...</option>
                                <option value="Wrong Medicine">Wrong Medicine</option>
                                <option value="Doctor Changed Prescription">Doctor Changed Prescription</option>
                                <option value="Customer Changed Mind">Customer Changed Mind</option>
                                <option value="Damaged / Defective">Damaged / Defective</option>
                              </select>
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-emerald-600">{formatCurrency(refund)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50 dark:bg-card border border-border rounded-lg p-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Refund to Customer</p>
                      <p className="text-4xl font-bold text-rose-600">{formatCurrency(totalRefundPreview)}</p>
                    </div>
                    {returnInvoiceData?.CustomerId && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Refund Mode</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRefundMode("Cash Refund")}
                            className={cn(
                              "flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition-all",
                              refundMode === "Cash Refund"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                            )}
                          >
                            Cash Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefundMode("Balance")}
                            className={cn(
                              "flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition-all",
                              refundMode === "Balance"
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                            )}
                          >
                            Adjust in Customer Balance
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button onClick={handleSubmitReturn} size="lg" className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg px-8" disabled={totalRefundPreview === 0 || isSubmittingReturn}>
                    <Printer className="mr-2 w-4 h-4" /> Process Return & Print Slip <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Return History Table */}
        {activeTab === 'return' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-muted-foreground" /> Returns History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead className="bg-secondary/50 border-b border-border text-left">
                  <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
                    <th className="px-3 py-3 font-semibold text-left">Date</th>
                    <th className="px-3 py-3 font-semibold text-left">Return No.</th>
                    <th className="px-3 py-3 font-semibold text-left">Original Inv. No.</th>
                    <th className="px-3 py-3 font-semibold text-left">Customer</th>
                    <th className="px-3 py-3 font-semibold text-center">Refund Amount</th>
                    <th className="px-3 py-3 font-semibold text-center">Refund Mode</th>
                    <th className="px-3 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border border-b border-border">
                  {loadingReturnHistory ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                  ) : returnHistoryItems.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No returns processed yet.</td></tr>
                  ) : (
                    returnHistoryItems.map((ret, index) => (
                      <tr key={ret.ReturnId} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-3 py-3 text-center font-medium text-muted-foreground">{(returnHistoryPage - 1) * returnHistoryPageSize + index + 1}</td>
                        <td className="px-3 py-3 text-muted-foreground text-left">{ret.ReturnDate}</td>
                        <td className="px-3 py-3 font-mono text-xs font-medium text-foreground text-left">{ret.ReturnInvoiceNumber}</td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground text-left">{ret.OriginalInvoiceNumber}</td>
                        <td className="px-3 py-3 font-medium text-foreground text-left">{ret.CustomerName}</td>
                        <td className="px-3 py-3 text-center font-bold text-rose-600">{formatCurrency(ret.TotalRefundAmount)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            "text-xs font-medium px-2 py-1 rounded-full",
                            ret.RefundMode === "Balance"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}>
                            {ret.RefundMode === "Balance" ? "Balance Adjust" : "Cash Refund"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleViewReturn(ret.ReturnId)} title="View Details">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => handlePrintReturn(ret.ReturnId)} title="Print 80mm Slip">
                              <Printer className="w-4 h-4" />
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
            {!loadingReturnHistory && returnHistoryTotal > 0 && (
              <div className="px-4 py-3 border-t border-border bg-white dark:bg-card flex flex-col sm:flex-row items-center justify-between text-sm text-slate-500 dark:text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <Select value={returnHistoryPageSize.toString()} onValueChange={v => { setReturnHistoryPageSize(Number(v)); setReturnHistoryPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder="25" /></SelectTrigger>
                    <SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    Showing {Math.min((returnHistoryPage - 1) * returnHistoryPageSize + 1, returnHistoryTotal)} – {Math.min(returnHistoryPage * returnHistoryPageSize, returnHistoryTotal)} of {returnHistoryTotal}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={returnHistoryPage === 1} onClick={() => setReturnHistoryPage(p => Math.max(1, p - 1))}>
                      Prev
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={returnHistoryPage * returnHistoryPageSize >= returnHistoryTotal} onClick={() => setReturnHistoryPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Sales History</h2>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-2 rounded-xl shadow-sm border border-border w-fit">
                <div className="flex flex-wrap items-center gap-2">
                  {["Today", "Yesterday", "This Week", "This Month", "This Year", "Custom Range"].map(preset => (
                    <Button
                      key={preset}
                      variant={historyFilters.datePreset === preset ? "default" : "outline"}
                      size="sm"
                      className={cn("rounded-full", historyFilters.datePreset === preset ? "bg-blue-600 text-white" : "text-muted-foreground")}
                      onClick={() => {
                        setHistoryFilters({ ...historyFilters, datePreset: preset });
                        setHistoryPage(1);
                      }}
                    >
                      {preset}
                      {preset === 'Custom Range' && historyFilters.startDate && historyFilters.endDate && historyFilters.datePreset === "Custom Range" && (
                        <Check className="w-3 h-3 ml-1 text-emerald-400" />
                      )}
                    </Button>
                  ))}
                </div>
                {historyFilters.datePreset === "Custom Range" && (
                  <div className="flex items-center gap-2 ml-2 animate-in fade-in duration-200">
                    <Input 
                      type="date" 
                      className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none h-9 w-[140px]" 
                      value={historyFilters.startDate} 
                      onChange={e => {
                        setHistoryFilters({ ...historyFilters, startDate: e.target.value });
                        setHistoryPage(1);
                      }} 
                      title="From Date" 
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input 
                      type="date" 
                      className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none h-9 w-[140px]" 
                      value={historyFilters.endDate} 
                      onChange={e => {
                        setHistoryFilters({ ...historyFilters, endDate: e.target.value });
                        setHistoryPage(1);
                      }} 
                      title="To Date" 
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {/* Status Filter: All | Paid | Partial Return | Returned */}
                <div className="inline-flex items-center bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm h-10">
                  {[
                    {
                      value: "all",
                      label: "All",
                      dot: "bg-slate-400 dark:bg-slate-500",
                      activeText: "text-slate-900 dark:text-slate-100",
                      activeRing: "ring-slate-300 dark:ring-slate-600",
                    },
                    {
                      value: "paid",
                      label: "Paid",
                      dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]",
                      activeText: "text-emerald-700 dark:text-emerald-400",
                      activeRing: "ring-emerald-500/25",
                    },
                    {
                      value: "partial_return",
                      label: "Partial Return",
                      dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
                      activeText: "text-amber-700 dark:text-amber-400",
                      activeRing: "ring-amber-500/25",
                    },
                    {
                      value: "returned",
                      label: "Returned",
                      dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]",
                      activeText: "text-rose-700 dark:text-rose-400",
                      activeRing: "ring-rose-500/25",
                    },
                  ].map(opt => {
                    const isActive = (historyFilters.status || "all") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setHistoryFilters(prev => ({ ...prev, status: opt.value }));
                          setHistoryPage(1);
                        }}
                        className={cn(
                          "relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 select-none flex items-center gap-1.5 whitespace-nowrap",
                          isActive
                            ? cn("bg-white dark:bg-slate-900 shadow-sm ring-1", opt.activeText, opt.activeRing)
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0 transition-all duration-200",
                            opt.dot,
                            isActive ? "scale-110" : "opacity-60"
                          )}
                        />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Search bar */}
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Search Invoice or Customer..."
                    className="pl-9 pr-8 h-10 bg-white dark:bg-slate-900/90 rounded-xl border-slate-200/80 dark:border-slate-700/80 shadow-sm text-xs placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                    value={historyFilters.q}
                    onChange={e => {
                      setHistoryFilters(prev => ({ ...prev, q: e.target.value }));
                      setHistoryPage(1);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { setHistoryPage(1); fetchHistory(); } }}
                  />
                  {historyFilters.q && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryFilters(prev => ({ ...prev, q: "" }));
                        setHistoryPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="bg-secondary/50 border-b border-border text-left">
                  <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
                    <th className="px-3 py-3 font-semibold text-left">Date & Time</th>
                    <th className="px-3 py-3 font-semibold text-left">Invoice No.</th>
                    <th className="px-3 py-3 font-semibold text-left">Customer</th>
                    <th className="px-3 py-3 font-semibold text-center">Total Amount</th>
                    <th className="px-3 py-3 font-semibold text-center">Paid</th>
                    <th className="px-3 py-3 font-semibold text-center">Balance Due</th>
                    <th className="px-3 py-3 font-semibold text-center">Status</th>
                    <th className="px-3 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border border-b border-border">
                  {loadingHistory ? (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading history...</td></tr>
                  ) : historyItems.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No invoices found matching criteria.</td></tr>
                  ) : (
                    historyItems.map((item, index) => {
                      const retAmt = Number(item.ReturnedAmount || 0);
                      const effectiveTotal = (item.NetAmount !== undefined && item.NetAmount !== null && Number(item.NetAmount) > 0)
                        ? Number(item.NetAmount)
                        : (retAmt > 0 ? Math.max(0, Number(item.GrandTotal || 0) - retAmt) : Number(item.GrandTotal || 0));
                      const balanceDue = Math.max(0, effectiveTotal - (item.PaidAmount || 0));
                      
                      const isReturned = item.Status === "Returned" || item.Status === "Fully Refunded" || (retAmt > 0 && retAmt >= Number(item.GrandTotal || 0));
                      const isPartiallyReturned = item.Status === "Partially Returned" || (retAmt > 0 && retAmt < Number(item.GrandTotal || 0));

                      let statusBadge = { label: "Unpaid", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" };
                      if (isReturned) statusBadge = { label: "Returned", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" };
                      else if (isPartiallyReturned) statusBadge = { label: "Partial Return", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" };
                      else if (balanceDue === 0) statusBadge = { label: "Paid", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" };
                      else if ((item.PaidAmount || 0) > 0) statusBadge = { label: "Partial", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" };
                      
                      return (
                        <tr key={item.SalesId} className="hover:bg-secondary/10">
                          <td className="px-3 py-3 text-center font-medium text-muted-foreground">{(historyPage - 1) * historyPageSize + index + 1}</td>
                          <td className="px-3 py-3 font-medium text-muted-foreground text-left">{item.TransactionDate}</td>
                          <td className="px-3 py-3 font-mono font-bold text-foreground text-left">{item.InvoiceNumber}</td>
                          <td className="px-3 py-3 text-left">{item.CustomerName}</td>
                          <td className="px-3 py-3 text-center font-bold">
                            {formatCurrency(effectiveTotal)}
                            {item.ReturnedAmount > 0 && <div className="text-[10px] text-rose-500 font-normal">-{formatCurrency(item.ReturnedAmount)} (Ret)</div>}
                          </td>
                          <td className="px-3 py-3 text-center font-medium text-emerald-600">{formatCurrency(item.PaidAmount || 0)}</td>
                          <td className={cn("px-3 py-3 text-center font-bold", balanceDue > 0 ? "text-rose-500" : "text-muted-foreground")}>
                            {formatCurrency(balanceDue)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", statusBadge.color)}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:bg-blue-50" onClick={() => handleView(item.InvoiceNumber, item.CashierName || "")} title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-slate-100" onClick={() => handleReprint(item.InvoiceNumber, item.CashierName || "", item.PaymentMethod)} title="Reprint">
                                <Printer className="w-4 h-4" />
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                disabled={isReturned}
                                className={cn(
                                  "h-7 w-7 transition-all",
                                  isReturned
                                    ? "text-slate-400 dark:text-slate-600 opacity-25 blur-[0.4px] cursor-not-allowed hover:bg-transparent"
                                    : "text-rose-500 hover:bg-rose-50"
                                )}
                                onClick={() => { 
                                  if (!isReturned) {
                                    onTabChange('return'); 
                                    setReturnInvoiceNo(item.InvoiceNumber); 
                                  }
                                }} 
                                title={isReturned ? "Already Returned" : "Return"}
                              >
                                <ArrowLeft className="w-4 h-4" />
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

            {/* Pagination */}
            {!loadingHistory && historyTotal > 0 && (
              <div className="px-4 py-3 border-t border-border bg-white dark:bg-card flex flex-col sm:flex-row items-center justify-between text-sm text-slate-500 dark:text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <Select value={historyPageSize.toString()} onValueChange={v => { setHistoryPageSize(Number(v)); setHistoryPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder="25" /></SelectTrigger>
                    <SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    Showing {Math.min((historyPage - 1) * historyPageSize + 1, historyTotal)} – {Math.min(historyPage * historyPageSize, historyTotal)} of {historyTotal}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm" className="h-8 px-3"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline" size="sm" className="h-8 px-3"
                      disabled={historyPage * historyPageSize >= historyTotal}
                      onClick={() => setHistoryPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Shortcuts */}
      {activeTab === 'pos' && showKeyboardShortcuts && (
        <div className="sticky bottom-0 left-0 right-0 z-50 h-16 bg-white dark:bg-card border-t border-border flex items-center px-6 gap-6 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] overflow-x-auto whitespace-nowrap mt-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="bg-secondary/80 text-foreground font-mono px-2 py-1 rounded text-xs font-semibold shadow-sm border border-border/50">F2</span>
            <span className="font-medium">Search Medicine</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="bg-secondary/80 text-foreground font-mono px-2 py-1 rounded text-xs font-semibold shadow-sm border border-border/50">F4</span>
            <span className="font-medium">Customer</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="bg-secondary/80 text-foreground font-mono px-2 py-1 rounded text-xs font-semibold shadow-sm border border-border/50">F5</span>
            <span className="font-medium">Hold Sale</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="bg-secondary/80 text-foreground font-mono px-2 py-1 rounded text-xs font-semibold shadow-sm border border-border/50">F8</span>
            <span className="font-medium">Recent Sales</span>
          </div>
        </div>
      )}



      {/* Completed Receipt Modal */}
      {completedReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-full overflow-hidden">

            {/* Modal Header Actions */}
            <div className="flex justify-between items-center p-4 border-b border-border bg-slate-50">
              <h2 className="font-bold text-foreground">{isReprintMode ? "Receipt Reprint" : "Transaction Complete"}</h2>
              <Button variant="ghost" size="sm" onClick={() => { setCompletedReceipt(null); setIsReprintMode(false); }}>Close</Button>
            </div>

            {/* Receipt Preview Area */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center">

              {/* Actual Printable Receipt (Styled like Thermal) */}
              {printerSettings ? (
                <ReceiptPreview 
                  settings={printerSettings}
                  currency={currencySymbol}
                  isReprint={isReprintMode}
                  invoiceNumber={completedReceipt.InvoiceNumber}
                  date={completedReceipt.Date?.split(' ')[0] || completedReceipt.Date}
                  time={completedReceipt.Date?.split(' ').slice(1).join(' ') || ""}
                  customerName={completedReceipt.CustomerName || "Walk-in Customer"}
                  cashierName={completedReceipt.Cashier}
                  paymentMethod={completedReceipt.PaymentMethod || "Cash"}
                  items={completedReceipt.Items.map((item: any) => ({
                    name: item.MedicineName,
                    qty: item.Quantity,
                    price: item.UnitPrice,
                    total: item.LineTotal,
                    batch: item.BatchCode,
                    exp: item.ExpiryDate,
                  }))}
                  subtotal={completedReceipt.SubTotal}
                  discount={completedReceipt.Discount}
                  tax={completedReceipt.Tax || completedReceipt.TaxAmount || 0}
                  grandTotal={completedReceipt.GrandTotal}
                  paidAmount={completedReceipt.PaidAmount}
                  changeDue={completedReceipt.ChangeDue}
                />
              ) : (
                <div className="p-4 text-center text-slate-500">Loading printer configuration...</div>
              )}
            </div>
            {/* Print Buttons Footer */}
            <div className="p-4 border-t border-border bg-slate-50 flex flex-col gap-3">
              <Button onClick={() => { autoPrintRef.current = false; handleThermalPrint(); }} className="w-full bg-slate-800 hover:bg-slate-900 text-white shadow">
                <Printer className="mr-2 w-4 h-4" /> Print Receipt (Thermal)
              </Button>
              <Button variant="outline" onClick={handlePrintReceipt} className="w-full">
                <Printer className="mr-2 w-4 h-4" /> Print via Browser (Fallback)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Modal */}
      {isAdminPinModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card w-full max-w-sm rounded-xl shadow-xl overflow-hidden border border-border">
            <div className="px-6 py-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2"><User className="w-5 h-5 text-rose-600" /> Manager Authorization</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setIsAdminPinModalOpen(false)}>✕</Button>
            </div>
            <form onSubmit={verifyAdminPin} className="p-6 space-y-4 text-left">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">A discount exceeding the {adminDiscountThreshold}% limit was detected. Please enter your login password to authorize this sale.</p>
                <label className="text-sm font-medium text-muted-foreground">Manager Password</label>
                <Input 
                  type="password"
                  value={adminPinInput} 
                  onChange={e => setAdminPinInput(e.target.value)} 
                  placeholder="Enter Password" 
                  autoFocus 
                  required 
                  className="text-center text-lg tracking-[0.2em]"
                />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAdminPinModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">Authorize & Complete</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden border border-border">
            <div className="px-6 py-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> Add Customer</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setIsAddCustomerOpen(false)}>✕</Button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Customer Name <span className="text-rose-500">*</span></label>
                <Input value={newCustomer.Name} onChange={e => setNewCustomer({ ...newCustomer, Name: e.target.value })} placeholder="e.g. John Doe" autoFocus required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                <Input value={newCustomer.Phone} onChange={e => setNewCustomer({ ...newCustomer, Phone: e.target.value })} placeholder="e.g. 0300-1234567" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Address (Optional)</label>
                <Input value={newCustomer.Address} onChange={e => setNewCustomer({ ...newCustomer, Address: e.target.value })} placeholder="City or Area" />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={addingCustomer}>
                  {addingCustomer ? "Saving..." : "Save Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Challan Print Area - used by ChallanPrint component */}
      <div id="challan-print-area" className="hidden print:block bg-white text-black w-full">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #challan-print-area, #challan-print-area * {
              visibility: visible;
            }
            #challan-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              margin: 0;
              padding: 0;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.35;
            }
            @page {
              size: 80mm auto;
              margin: 2mm;
            }
          }
        `}} />
      </div>
    </div>
  );
}
