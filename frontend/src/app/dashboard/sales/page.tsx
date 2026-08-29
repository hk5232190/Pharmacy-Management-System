"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
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
  Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";

// --- Interfaces ---
interface SaleInit {
  InvoiceNumber: string;
  DefaultTaxRate: number;
  MaxDiscountPercentage: number;
  DiscountEnabled: boolean;
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

  const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'return'>('pos');

  return <POSBillingPage key={refreshKey} refreshState={refreshState} onRefresh={handleRefresh} activeTab={activeTab} onTabChange={setActiveTab} />;
}

function POSBillingPage({ onRefresh, refreshState, activeTab, onTabChange }: { onRefresh: () => void, refreshState: "idle" | "loading" | "done", activeTab: "pos" | "history" | "return", onTabChange: (tab: "pos" | "history" | "return") => void }) {
  const { formatNumber, formatCurrency, currencySymbol } = useSystemPreferences();
  // (activeTab is now managed by the wrapper so it survives a refresh reset)
  const [loadingInit, setLoadingInit] = useState(true);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Digital" | "Credit">("Cash");
  const autoPrintRef = useRef(false);

  // --- Modals ---
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);

  // --- Return States ---
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnInvoiceData, setReturnInvoiceData] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [refundMode, setRefundMode] = useState<"Cash Refund" | "Balance">("Cash Refund");

  // --- History States ---
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyFilters, setHistoryFilters] = useState({ datePreset: "Today", startDate: "", endDate: "", paymentMethod: "", userId: "", q: "" });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyPageSize = 15;
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- Return History States ---
  const [returnHistoryItems, setReturnHistoryItems] = useState<any[]>([]);
  const [returnHistoryPage, setReturnHistoryPage] = useState(1);
  const [returnHistoryTotal, setReturnHistoryTotal] = useState(0);
  const [loadingReturnHistory, setLoadingReturnHistory] = useState(false);
  const returnHistoryPageSize = 10;

  const [isReprintMode, setIsReprintMode] = useState(false);

  // --- KPIs ---
  const [kpis, setKpis] = useState({
    todaysSales: 0,
    totalRevenue: 0,
    totalInvoices: 0,
    itemsSoldToday: 0,
    pendingPayments: 0
  });

  const fetchKpis = async () => {
    try {
      const res = await apiClient.get('/sales/kpi');
      if (res.success && res.data) {
        setKpis(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch KPIs", err);
    }
  };

  // --- Initialization ---
  useEffect(() => {
    fetchInitData();
    fetchKpis();
    // Hotkeys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); toast.info("Help: Use F-keys for quick actions"); }
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === "F4") { e.preventDefault(); document.getElementById("customer-select")?.focus(); }
      if (e.key === "F5") { e.preventDefault(); toast("Sale Held temporarily."); }
      if (e.key === "F8") { e.preventDefault(); toast("Opening Recent Sales..."); }
      if (e.key === "F9") { e.preventDefault(); setCart([]); toast.success("Cart cleared"); }
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
        setRequireAdminPin(initRes.data.RequireAdminPinForDiscount);
        setAdminDiscountThreshold(initRes.data.AdminDiscountThreshold);
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
      if (searchQuery.trim().length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
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
    // FEFO: Auto-pick the first batch (since backend sorts ExpiryDate ascending)
    const bestBatch = product.Batches[0];

    const uniqueId = `${product.MedicineId}-${bestBatch.BatchId}`;

    setCart(prev => {
      const existing = prev.find(i => i.id === uniqueId);
      if (existing) {
        if (existing.Quantity + 1 > existing.AvailableStock) {
          toast.error(`Cannot add more. Only ${existing.AvailableStock} in stock.`);
          return prev;
        }
        return prev.map(i =>
          i.id === uniqueId
            ? { ...i, Quantity: i.Quantity + 1, LineTotal: calculateLineTotal(i.Quantity + 1, i.UnitPrice, i.Discount, i.TaxPercent) }
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
        LineTotal: calculateLineTotal(1, bestBatch.UnitPrice, discountEnabled ? maxDiscount : 0, taxRate),
        RequiresPrescription: product.RequiresPrescription
      }];
    });

    setSearchQuery("");
    setSearchResults([]);
    toast.success(`Added ${product.MedicineName}`);
  };

  const calculateLineTotal = (qty: number, price: number, discountPercent: number, taxRate: number) => {
    const base = qty * price;
    const discountAmount = base * (discountPercent / 100);
    const discounted = base - discountAmount;
    const taxAmount = discounted * (taxRate / 100);
    return discounted + taxAmount;
  };

  const updateCartItem = (id: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate if qty, discount, or tax changed
        if (['Quantity', 'Discount', 'TaxPercent'].includes(field)) {
          if (field === 'Discount') {
            if (!discountEnabled) {
              toast.error("Discounts are disabled globally.");
              updated.Discount = 0;
            } else if (value > maxDiscount) {
              toast.error(`Maximum allowed discount is ${maxDiscount}%.`);
              updated.Discount = maxDiscount;
            }
          }

          // enforce stock limit
          if (field === 'Quantity' && value > item.AvailableStock) {
            toast.error(`Only ${item.AvailableStock} units available in this batch.`);
            updated.Quantity = item.AvailableStock;
          }
          if (field === 'Quantity' && value < 1) updated.Quantity = 1;

          updated.LineTotal = calculateLineTotal(updated.Quantity, updated.UnitPrice, updated.Discount, updated.TaxPercent);
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
  const totalDiscount = cart.reduce((sum, item) => sum + ((item.Quantity * item.UnitPrice) * (item.Discount / 100)), 0);
  const discountedSubtotal = subtotal - totalDiscount;

  // Actually line total already includes tax, but for summary we want total tax
  const totalTax = cart.reduce((sum, item) => {
    const base = item.Quantity * item.UnitPrice;
    const discountAmount = base * (item.Discount / 100);
    const discounted = base - discountAmount;
    return sum + (discounted * (item.TaxPercent / 100));
  }, 0);

  const grandTotal = cart.reduce((sum, item) => sum + item.LineTotal, 0);
  const totalItemsCount = cart.length;
  const totalQtyCount = cart.reduce((sum, item) => sum + item.Quantity, 0);
  const changeDue = Math.max(0, paidAmount - grandTotal);
  const remainingBalance = Math.max(0, grandTotal - paidAmount);

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

    if (!isSkip && requireAdminPin) {
      const needsPin = cart.some(item => item.Discount > adminDiscountThreshold);
      if (needsPin) {
        setIsAdminPinModalOpen(true);
        return;
      }
    }

    try {
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
          Discount: (item.Quantity * item.UnitPrice) * (item.Discount / 100),
          TaxPercent: item.TaxPercent,
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
        fetchInitData(); // get next invoice number
        fetchKpis(); // update KPIs
      } else {
        toast.error(res.error || "Failed to complete sale");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during checkout");
    }
  };

  const handleThermalPrint = async () => {
    if (!completedReceipt) return;
    setIsPrintingThermal(true);
    try {
      const url = completedReceipt.type === 'return' 
        ? `/sales/return/${completedReceipt.ReturnId}/print-thermal`
        : `/sales/${completedReceipt.SalesId}/print-thermal?is_reprint=${isReprintMode}`;
        
      const res = await apiClient.post(url, {});
      if (res.success) {
        toast.success("Sent to ESC/POS thermal printer spooler successfully!");
      } else {
        toast.error("Failed to print thermal receipt");
      }
    } catch (err) {
      toast.error("Error communicating with print spooler");
    } finally {
      setIsPrintingThermal(false);
    }
  };

  useEffect(() => {
    if (completedReceipt && autoPrintRef.current) {
      autoPrintRef.current = false;
      handleThermalPrint();
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
    return sum + (item.UnitPrice * item.ReturnQuantity);
  }, 0);

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter(i => i.ReturnQuantity > 0);
    if (itemsToReturn.length === 0) return toast.error("Select at least one item to return");

    const missingReason = itemsToReturn.find(i => !i.ReturnReason);
    if (missingReason) return toast.error(`Select a return reason for ${missingReason.MedicineName}`);

    const reasons = [...new Set(itemsToReturn.map(i => i.ReturnReason).filter(Boolean))];
    const combinedReason = reasons.join('; ');

    try {
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
    }
  };

  const fetchReturnHistory = async () => {
    setLoadingReturnHistory(true);
    try {
      const res = await apiClient.get(`/sales/return-history?page=${returnHistoryPage}&page_size=${returnHistoryPageSize}`);
      if (res.success && res.data) {
        setReturnHistoryItems(res.data.items);
        setReturnHistoryTotal(res.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReturnHistory(false);
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
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      
      // Handle Date Presets
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
        }
      }
      
      params.append("page", String(historyPage));
      params.append("page_size", String(historyPageSize));
      if (historyFilters.q) params.append("q", historyFilters.q);

      const res = await apiClient.get(`/sales/history?${params.toString()}`);
      if (res.success) {
        setHistoryItems(res.data.items);
        setHistoryTotal(res.data.total);
      }
    } catch (err: any) {
      toast.error("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

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
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
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

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyPage, historyFilters.datePreset]);

  useEffect(() => {
    if (activeTab === 'return') {
      fetchReturnHistory();
    }
  }, [activeTab, returnHistoryPage]);

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

        {/* KPI Cards — hidden on Sales Return tab */}
        {activeTab !== 'return' && (() => {
          const salesCards = [
            { label: "Today's Sales",   val: `${formatCurrency(kpis.todaysSales)}`,     icon: ShoppingCart, accent: "blue" },
            { label: "Total Revenue",   val: `${formatCurrency(kpis.totalRevenue)}`,     icon: FileText,     accent: "emerald" },
            { label: "Total Invoices",  val: kpis.totalInvoices.toString(),               icon: FileText,     accent: "indigo" },
            { label: "Items Sold Today",val: kpis.itemsSoldToday.toString(),              icon: ShoppingCart, accent: "amber" },
            { label: "Pending Payments",val: `${formatCurrency(kpis.pendingPayments)}`,  icon: FileText,     accent: "rose" },
          ];

          const accentMap: Record<string, { border: string; iconCls: string; text: string; bg: string }> = {
            blue:    { border: "border-l-blue-500",    iconCls: "text-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20" },
            emerald: { border: "border-l-emerald-500", iconCls: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            indigo:  { border: "border-l-indigo-500",  iconCls: "text-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-900/20" },
            amber:   { border: "border-l-amber-500",   iconCls: "text-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
            rose:    { border: "border-l-rose-500",    iconCls: "text-rose-500",    text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20" },
          };

          return (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {salesCards.map(({ label, val, icon: Icon, accent }) => {
                const a = accentMap[accent];
                return (
                  <div
                    key={label}
                    className={cn(
                      "relative bg-white dark:bg-card rounded-xl border border-border border-l-4 shadow-sm p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-md",
                      a.border
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.bg)}>
                      <Icon className={cn("w-5 h-5", a.iconCls)} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                      <p className={cn("text-2xl font-extrabold leading-none tabular-nums truncate", a.text)}>{val}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}


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

            {/* Left Column (Customer & Invoice) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-4">
                <h3 className="font-semibold text-foreground mb-4">1. Customer & Invoice</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Invoice No.</label>
                    <Input readOnly value={invoiceNo} className="bg-secondary/30 font-mono text-sm" placeholder="Generating..." />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Sale Date</label>
                      <Input readOnly value={new Date().toLocaleDateString('en-GB')} className="bg-secondary/30 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
                      <Input readOnly value={new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} className="bg-secondary/30 text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer <span className="text-[10px] bg-secondary px-1 py-0.5 rounded ml-1">F4</span></label>
                    <div className="flex gap-2">
                      <select
                        id="customer-select"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                      >
                        <option value="walkin">Walk-in Customer</option>
                        {customers.map((c: any) => (
                          <option key={c.CustomerId} value={c.CustomerId}>{c.Name} {c.Phone ? `(${c.Phone})` : ''}</option>
                        ))}
                      </select>
                      <Button onClick={() => setIsAddCustomerOpen(true)} variant="outline" size="icon" className="shrink-0" title="Add New Customer"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>


                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Salesperson</label>
                    <Input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className="text-sm" placeholder="Enter salesperson name" />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column (Search & Cart) */}
            <div className="lg:col-span-6 space-y-6 flex flex-col">
              <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-4 relative z-20">
                <h3 className="font-semibold text-foreground mb-3 flex justify-between items-center">
                  2. Search Medicine
                  <div className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                    <span className="bg-secondary px-1.5 py-0.5 rounded">F2</span> Focus
                  </div>
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search medicine by name, barcode, or code..."
                    className="pl-9 pr-10 text-base py-6"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />

                  {/* Search Dropdown */}
                  {searchQuery.trim().length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No medicines found with available stock.</div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {searchResults.map((res) => (
                            <li
                              key={res.MedicineId}
                              className="p-3 hover:bg-secondary/20 cursor-pointer transition-colors flex justify-between items-center"
                              onClick={() => handleSelectProduct(res)}
                            >
                              <div>
                                <p className="font-medium text-foreground flex items-center gap-2">
                                  {res.MedicineName}

                                </p>
                                <p className="text-xs text-muted-foreground">{res.GenericName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(res.Batches[0].UnitPrice)}</p>
                                <p className="text-xs text-muted-foreground">Stock: {res.Batches[0].AvailableStock}</p>
                              </div>
                            </li>
                          ))}
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
                    <thead className="sticky top-0 z-10 bg-white dark:bg-card shadow-sm">
                      <tr className="text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                        <th className="px-3 py-3 font-semibold">#</th>
                        <th className="px-3 py-3 font-semibold">Medicine</th>
                        <th className="px-3 py-3 font-semibold">Batch</th>
                        <th className="px-3 py-3 font-semibold text-center">Avail. Stock</th>
                        <th className="px-3 py-3 font-semibold text-right">Unit Price</th>
                        <th className="px-3 py-3 font-semibold text-center w-28">Qty</th>
                        <th className="px-3 py-3 font-semibold text-center">Disc (%)</th>
                        <th className="px-3 py-3 font-semibold text-center">Tax (%)</th>
                        <th className="px-3 py-3 font-semibold text-right">Line Total</th>
                        <th className="px-3 py-3 font-semibold text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cart.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-16 text-center">
                            <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground">Your cart is empty.</p>
                            <p className="text-xs text-muted-foreground mt-1">Search and select a medicine to begin.</p>
                          </td>
                        </tr>
                      ) : (
                        cart.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-3 py-3 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-3 font-medium text-foreground">
                              {item.MedicineName}

                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.BatchCode}</td>
                            <td className="px-3 py-3 text-center text-muted-foreground text-xs">{item.AvailableStock}</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(item.UnitPrice)}</td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center border border-input rounded-md overflow-hidden h-8">
                                <button onClick={() => updateCartItem(item.id, 'Quantity', item.Quantity - 1)} className="px-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">-</button>
                                <input
                                  type="number"
                                  className="w-10 text-center bg-transparent border-none focus:ring-0 text-sm h-full"
                                  value={item.Quantity}
                                  onChange={(e) => updateCartItem(item.id, 'Quantity', parseInt(e.target.value) || 1)}
                                />
                                <button onClick={() => updateCartItem(item.id, 'Quantity', item.Quantity + 1)} className="px-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">+</button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                type="number"
                                max="100"
                                className="h-8 w-16 text-center mx-auto"
                                value={item.Discount}
                                onChange={(e) => updateCartItem(item.id, 'Discount', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Input
                                type="number"
                                className="h-8 w-16 text-center mx-auto"
                                value={item.TaxPercent}
                                onChange={(e) => updateCartItem(item.id, 'TaxPercent', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-3 py-3 text-right font-bold">{formatCurrency(item.LineTotal)}</td>
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
                <h3 className="font-semibold text-foreground mb-4">4. Bill Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Items</span>
                    <span className="font-medium text-foreground">{totalItemsCount}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-medium text-rose-500">- {formatCurrency(totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({taxRate}%)</span>
                    <span className="font-medium text-foreground">{formatCurrency(totalTax)}</span>
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
                          type="number"
                          className="w-24 h-9 font-bold text-right"
                          value={paidAmount || ""}
                          onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
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
                  <Button id="complete-sale-btn" onClick={handleCompleteSale} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-500/20" disabled={cart.length === 0}>
                    Complete Sale <span className="ml-2 text-[10px] bg-blue-500 px-1 rounded border border-blue-400">F10</span> <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button onClick={() => { autoPrintRef.current = true; handleCompleteSale(); }} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md" disabled={cart.length === 0}>
                    <Printer className="mr-2 w-4 h-4" /> Save & Print
                  </Button>
                  <Button variant="outline" onClick={() => { toast("Sale held temporarily. Cart preserved."); }} className="w-full h-11 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 font-medium">
                    <Pause className="mr-2 w-4 h-4" /> Hold Sale
                  </Button>
                  <Button variant="outline" onClick={() => { setCart([]); setPaidAmount(0); }} className="w-full h-11 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 font-medium">
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
                    <thead className="bg-secondary/50 border-b border-border">
                      <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                        <th className="px-3 py-3 font-semibold">Medicine Name</th>
                        <th className="px-3 py-3 font-semibold">Batch No.</th>
                        <th className="px-3 py-3 font-semibold text-right">Sold Price</th>
                        <th className="px-3 py-3 font-semibold text-center">Sold Qty</th>
                        <th className="px-3 py-3 font-semibold text-center w-24">Return Qty</th>
                        <th className="px-3 py-3 font-semibold w-52">Return Reason</th>
                        <th className="px-3 py-3 font-semibold text-right">Refund Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {returnItems.map(item => {
                        const maxReturnable = item.Quantity - item.ReturnedQuantity;
                        const isFullyReturned = maxReturnable === 0;
                        const refund = item.UnitPrice * item.ReturnQuantity;

                        return (
                          <tr key={item.SalesItemId} className={isFullyReturned ? "opacity-50 bg-secondary/20" : "hover:bg-secondary/10"}>
                            <td className="px-3 py-3 font-medium text-foreground">{item.MedicineName}</td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.BatchCode}</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(item.UnitPrice)}</td>
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
                            <td className="px-3 py-3">
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
                            <td className="px-3 py-3 text-right font-bold text-emerald-600">{formatCurrency(refund)}</td>
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
                  <Button onClick={handleSubmitReturn} size="lg" className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg px-8" disabled={totalRefundPreview === 0}>
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
                <thead className="bg-secondary/50 border-b border-border">
                  <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Return No.</th>
                    <th className="px-3 py-3 font-semibold">Original Inv. No.</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold text-right">Refund Amount</th>
                    <th className="px-3 py-3 font-semibold">Refund Mode</th>
                    <th className="px-3 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingReturnHistory ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                  ) : returnHistoryItems.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No returns processed yet.</td></tr>
                  ) : (
                    returnHistoryItems.map((ret, index) => (
                      <tr key={ret.ReturnId} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-3 py-3 text-center font-medium text-muted-foreground">{(returnHistoryPage - 1) * returnHistoryPageSize + index + 1}</td>
                        <td className="px-3 py-3 text-muted-foreground">{ret.ReturnDate}</td>
                        <td className="px-3 py-3 font-mono text-xs font-medium text-foreground">{ret.ReturnInvoiceNumber}</td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{ret.OriginalInvoiceNumber}</td>
                        <td className="px-3 py-3 font-medium text-foreground">{ret.CustomerName}</td>
                        <td className="px-3 py-3 text-right font-bold text-rose-600">{formatCurrency(ret.TotalRefundAmount)}</td>
                        <td className="px-3 py-3">
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
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <div>
                  Showing {Math.min((returnHistoryPage - 1) * returnHistoryPageSize + 1, returnHistoryTotal)} – {Math.min(returnHistoryPage * returnHistoryPageSize, returnHistoryTotal)} of {returnHistoryTotal} returns
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={returnHistoryPage === 1} onClick={() => setReturnHistoryPage(p => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={returnHistoryPage * returnHistoryPageSize >= returnHistoryTotal} onClick={() => setReturnHistoryPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Sales History</h2>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {["Today", "Yesterday", "This Week", "This Month", "All"].map(preset => (
                  <Button
                    key={preset}
                    variant={historyFilters.datePreset === preset ? "default" : "outline"}
                    size="sm"
                    className={historyFilters.datePreset === preset ? "bg-blue-600 text-white" : "text-muted-foreground"}
                    onClick={() => {
                      setHistoryFilters({ ...historyFilters, datePreset: preset });
                      setHistoryPage(1);
                    }}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Invoice or Customer..."
                    className="pl-9 h-9"
                    value={historyFilters.q}
                    onChange={e => setHistoryFilters({ ...historyFilters, q: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { setHistoryPage(1); fetchHistory(); } }}
                  />
                </div>
                <Button onClick={exportPDF} variant="outline" size="sm" className="h-9"><FileText className="w-4 h-4 mr-2 text-rose-500" /> Export PDF</Button>
                <Button onClick={exportCSV} variant="outline" size="sm" className="h-9"><FileText className="w-4 h-4 mr-2 text-emerald-500" /> Export CSV</Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
                    <th className="px-3 py-3 font-semibold">Date & Time</th>
                    <th className="px-3 py-3 font-semibold">Invoice No.</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold text-right">Total Amount</th>
                    <th className="px-3 py-3 font-semibold text-right">Paid</th>
                    <th className="px-3 py-3 font-semibold text-right">Balance Due</th>
                    <th className="px-3 py-3 font-semibold text-center">Status</th>
                    <th className="px-3 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingHistory ? (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading history...</td></tr>
                  ) : historyItems.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No invoices found matching criteria.</td></tr>
                  ) : (
                    historyItems.map((item, index) => {
                      const balanceDue = Math.max(0, item.GrandTotal - (item.PaidAmount || 0));
                      let statusBadge = { label: "Unpaid", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" };
                      if (balanceDue === 0) statusBadge = { label: "Paid", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" };
                      else if ((item.PaidAmount || 0) > 0) statusBadge = { label: "Partial", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" };
                      
                      return (
                        <tr key={item.SalesId} className="hover:bg-secondary/10">
                          <td className="px-3 py-3 text-center font-medium text-muted-foreground">{(historyPage - 1) * historyPageSize + index + 1}</td>
                          <td className="px-3 py-3 font-medium text-muted-foreground">{item.TransactionDate}</td>
                          <td className="px-3 py-3 font-mono font-bold text-foreground">{item.InvoiceNumber}</td>
                          <td className="px-3 py-3">{item.CustomerName}</td>
                          <td className="px-3 py-3 text-right font-bold">{formatCurrency(item.GrandTotal)}</td>
                          <td className="px-3 py-3 text-right font-medium text-emerald-600">{formatCurrency(item.PaidAmount || 0)}</td>
                          <td className={cn("px-3 py-3 text-right font-bold", balanceDue > 0 ? "text-rose-500" : "text-muted-foreground")}>
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
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:bg-rose-50" onClick={() => { setActiveTab('return'); setReturnInvoiceNo(item.InvoiceNumber); }} title="Return">
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
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <div>
                  Showing {Math.min((historyPage - 1) * historyPageSize + 1, historyTotal)} - {Math.min(historyPage * historyPageSize, historyTotal)} of {historyTotal} invoices
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={historyPage * historyPageSize >= historyTotal}
                    onClick={() => setHistoryPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Shortcuts */}
      {activeTab === 'pos' && (
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
              <div id="print-area" className="bg-white p-6 shadow-sm w-full max-w-[80mm] text-black font-mono text-xs mx-auto relative">

                {isReprintMode && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 overflow-hidden">
                    <span className="text-4xl font-bold transform -rotate-45 whitespace-nowrap text-black">DUPLICATE / REPRINT</span>
                  </div>
                )}

                <div className="text-center mb-4 relative z-10">
                  <h2 className="font-bold text-base mb-1">PHARMACY MANAGEMENT SYSTEM</h2>
                  <p>123 Health Ave, Medical City</p>
                  <p>Tel: +1 234 567 8900</p>
                </div>

                {isReprintMode && (
                  <div className="text-center font-bold text-sm mb-4 border-y border-black py-1 relative z-10">
                    *** DUPLICATE / REPRINT ***
                  </div>
                )}

                <div className="mb-4 pb-2 border-b border-dashed border-gray-400 relative z-10">
                  <div className="flex justify-between"><span>Invoice:</span> <span>{completedReceipt.InvoiceNumber}</span></div>
                  <div className="flex justify-between"><span>Date:</span> <span>{completedReceipt.Date}</span></div>
                  <div className="flex justify-between"><span>Cashier:</span> <span>{completedReceipt.Cashier}</span></div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between font-bold border-b border-dashed border-gray-400 pb-1 mb-2">
                    <span>Item</span>
                    <span>Total</span>
                  </div>
                  {completedReceipt.Items.map((item: CartItem) => (
                    <div key={item.id} className="mb-2">
                      <div className="font-bold">{item.MedicineName}</div>
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Batch: {item.BatchCode} | Exp: {item.ExpiryDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{item.Quantity} x {formatCurrency(item.UnitPrice)}</span>
                        <span>{formatCurrency(item.LineTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 mb-4 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(completedReceipt.SubTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>- {formatCurrency(completedReceipt.Discount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm mt-2">
                    <span>GRAND TOTAL:</span>
                    <span>{formatCurrency(completedReceipt.GrandTotal)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 mb-6 space-y-1">
                  <div className="flex justify-between">
                    <span>Paid:</span>
                    <span>{formatCurrency(completedReceipt.PaidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change Due:</span>
                    <span>{formatCurrency(completedReceipt.ChangeDue)}</span>
                  </div>
                </div>

                <div className="text-center text-[10px] text-gray-500">
                  <p className="mb-1">Thank you for your visit!</p>
                  <p>Software License ID: LIC-9942-AX3</p>
                </div>
              </div>

            </div>

            {/* Print Buttons Footer */}
            <div className="p-4 border-t border-border bg-slate-50 flex flex-col gap-3">
              <Button onClick={() => window.print()} className="w-full bg-slate-800 hover:bg-slate-900 text-white shadow">
                <Printer className="mr-2 w-4 h-4" /> Print Standard / Save PDF
              </Button>
              <Button onClick={handleThermalPrint} disabled={isPrintingThermal} variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                <Printer className="mr-2 w-4 h-4" /> {isPrintingThermal ? "Spooling..." : "Print to Thermal (ESC/POS)"}
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
    </div>
  );
}
