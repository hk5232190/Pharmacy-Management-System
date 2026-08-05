"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";
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
  Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface SaleInit {
  InvoiceNumber: string;
  DefaultTaxRate: number;
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

export default function POSBillingPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'return'>('pos');
  const [loadingInit, setLoadingInit] = useState(true);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [prescriptionRef, setPrescriptionRef] = useState("");
  const [salesperson, setSalesperson] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // --- Modals ---
  const [prescriptionPromptObj, setPrescriptionPromptObj] = useState<ProductSearchResponse | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);

  // --- Return States ---
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnInvoiceData, setReturnInvoiceData] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]); // holds ReturnQty and Condition per SalesItemId
  const [returnReason, setReturnReason] = useState("");

  // --- History States ---
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyFilters, setHistoryFilters] = useState({ startDate: "", endDate: "", paymentMethod: "", userId: "", q: "" });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isReprintMode, setIsReprintMode] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    fetchInitData();
    // Hotkeys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); toast("Help: Use F-keys for quick actions", { icon: "ℹ️" }); }
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
      }

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setSalesperson(user.FullName || user.Username || "Admin");
      }

      const custRes = await apiClient.get('/customer');
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

    if (product.RequiresPrescription && !prescriptionRef) {
      setPrescriptionPromptObj(product);
      return;
    }

    addToCart(product);
  };

  const confirmPrescription = (ref: string) => {
    setPrescriptionRef(ref);
    if (prescriptionPromptObj) {
      addToCart(prescriptionPromptObj);
      setPrescriptionPromptObj(null);
    }
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
        Discount: 0,
        TaxPercent: taxRate,
        LineTotal: calculateLineTotal(1, bestBatch.UnitPrice, 0, taxRate),
        RequiresPrescription: product.RequiresPrescription
      }];
    });

    setSearchQuery("");
    setSearchResults([]);
    toast.success(`Added ${product.MedicineName}`);
  };

  const calculateLineTotal = (qty: number, price: number, discount: number, taxRate: number) => {
    const base = qty * price;
    const discounted = base - discount;
    const taxAmount = discounted * (taxRate / 100);
    return discounted + taxAmount;
  };

  const updateCartItem = (id: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate if qty, discount, or tax changed
        if (['Quantity', 'Discount', 'TaxPercent'].includes(field)) {
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
  const totalDiscount = cart.reduce((sum, item) => sum + item.Discount, 0);
  const discountedSubtotal = subtotal - totalDiscount;

  // Actually line total already includes tax, but for summary we want total tax
  const totalTax = cart.reduce((sum, item) => {
    const base = item.Quantity * item.UnitPrice - item.Discount;
    return sum + (base * (item.TaxPercent / 100));
  }, 0);

  const grandTotal = cart.reduce((sum, item) => sum + item.LineTotal, 0);
  const totalItemsCount = cart.length;
  const totalQtyCount = cart.reduce((sum, item) => sum + item.Quantity, 0);
  const changeDue = Math.max(0, paidAmount - grandTotal);
  const remainingBalance = Math.max(0, grandTotal - paidAmount);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    // Check prescription requirement
    const needsPrescription = cart.some(item => item.RequiresPrescription);
    if (needsPrescription && !prescriptionRef) {
      toast.error("Prescription reference is required to complete this sale.");
      document.getElementById('prescription-ref-input')?.focus();
      return;
    }

    try {
      const payload = {
        CustomerId: selectedCustomerId === 'walkin' ? null : parseInt(selectedCustomerId),
        SubTotal: subtotal,
        DiscountAmount: totalDiscount,
        TaxAmount: totalTax,
        GrandTotal: grandTotal,
        PaidAmount: paidAmount,
        PaymentMethod: "Cash",
        PrescriptionRef: prescriptionRef || null,
        Items: cart.map(item => ({
          MedicineId: item.MedicineId,
          BatchId: item.BatchId,
          Quantity: item.Quantity,
          UnitPrice: item.UnitPrice,
          Discount: item.Discount,
          TaxPercent: item.TaxPercent,
          LineTotal: item.LineTotal,
          RequiresPrescription: item.RequiresPrescription
        }))
      };

      const res = await apiClient.post('/sales', payload);
      if (res.success) {
        toast.success(`Sale completed! Invoice: ${res.data.InvoiceNumber}`);

        // Populate Receipt Data
        setCompletedReceipt({
          InvoiceNumber: res.data.InvoiceNumber,
          SalesId: res.data.SalesId,
          Date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          Cashier: salesperson,
          Items: cart,
          SubTotal: subtotal,
          Discount: totalDiscount,
          Tax: totalTax,
          GrandTotal: grandTotal,
          PaidAmount: paidAmount,
          ChangeDue: changeDue
        });

        setCart([]);
        setPaidAmount(0);
        setPrescriptionRef("");
        fetchInitData(); // get next invoice number
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
      const res = await apiClient.post(`/sales/${completedReceipt.SalesId}/print-thermal?is_reprint=${isReprintMode}`);
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
          ItemCondition: 'Restockable'
        })));
        setReturnReason("");
      }
    } catch (err: any) {
      toast.error(err.message || "Invoice not found");
      setReturnInvoiceData(null);
    }
  };

  const updateReturnItem = (salesItemId: int, field: string, value: any) => {
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
    const ratio = item.ReturnQuantity / item.Quantity;
    return sum + (item.TotalPrice * ratio);
  }, 0);

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter(i => i.ReturnQuantity > 0);
    if (itemsToReturn.length === 0) return toast.error("Select at least one item to return");
    if (!returnReason.trim()) return toast.error("Return reason is mandatory");

    try {
      const payload = {
        InvoiceNumber: returnInvoiceData.InvoiceNumber,
        Reason: returnReason,
        Items: itemsToReturn.map(i => ({
          SalesItemId: i.SalesItemId,
          BatchId: i.BatchId,
          ReturnQuantity: i.ReturnQuantity,
          ItemCondition: i.ItemCondition
        }))
      };
      const res = await apiClient.post('/sales/return', payload);
      if (res.success) {
        toast.success(`Return Processed! Refund: ₹${res.data.RefundAmount.toFixed(2)}`);
        setReturnInvoiceData(null);
        setReturnInvoiceNo("");
        setReturnItems([]);
        setReturnReason("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    }
  };

  // --- Sales History Logic ---
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyFilters.startDate) params.append("start_date", historyFilters.startDate);
      if (historyFilters.endDate) params.append("end_date", historyFilters.endDate);
      if (historyFilters.paymentMethod) params.append("payment_method", historyFilters.paymentMethod);
      if (historyFilters.userId) params.append("user_id", historyFilters.userId);
      if (historyFilters.q) params.append("q", historyFilters.q);

      const res = await apiClient.get(`/sales/history?${params.toString()}`);
      if (res.success) {
        setHistoryItems(res.data);
      }
    } catch (err: any) {
      toast.error("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

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

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50 dark:bg-background relative">
      <div className="flex-1 p-4 lg:p-6 pb-6">

        {/* Header */}
        <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales & POS Billing</h1>
            <p className="text-sm text-muted-foreground mt-1">Process medicine sales, generate invoices, accept payments.</p>
          </div>
        </div>

        {/* KPIs (Placeholders for 6.1 Layout) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Today's Sales", val: "₹ 0.00", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
            { label: "Total Revenue", val: "₹ 0.00", icon: FileText, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Total Invoices", val: "0", icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
            { label: "Items Sold Today", val: "0", icon: ShoppingCart, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
            { label: "Pending Payments", val: "₹ 0.00", icon: FileText, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20" },
          ].map((k, i) => (
            <div key={i} className="bg-white dark:bg-card rounded-xl border border-border p-4 flex items-center gap-4 shadow-sm">
              <div className={cn("p-3 rounded-xl", k.bg, k.color)}>
                <k.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                <h4 className="text-lg font-bold text-foreground">{k.val}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Action Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-card p-1.5 rounded-lg border border-border shadow-sm w-fit">
          <Button onClick={() => setActiveTab('pos')} variant={activeTab === 'pos' ? "default" : "ghost"} size="sm" className={cn("px-4 shadow-none", activeTab === 'pos' ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-muted-foreground hover:text-foreground")}><ShoppingCart className="w-4 h-4 mr-2" /> New Sale (POS)</Button>
          <Button onClick={() => setActiveTab('history')} variant={activeTab === 'history' ? "default" : "ghost"} size="sm" className={cn("px-4 shadow-none", activeTab === 'history' ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-muted-foreground hover:text-foreground")}><FileText className="w-4 h-4 mr-2" /> Sales History</Button>
          <Button onClick={() => setActiveTab('return')} variant={activeTab === 'return' ? "default" : "ghost"} size="sm" className={cn("px-4 shadow-none", activeTab === 'return' ? "bg-rose-600 hover:bg-rose-700 text-white" : "text-muted-foreground hover:text-foreground")}><Trash2 className="w-4 h-4 mr-2" /> Sales Return</Button>
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
                      <Button variant="outline" size="icon" className="shrink-0"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Prescription Ref. (Optional)</label>
                    <Input
                      id="prescription-ref-input"
                      placeholder="Enter Prescription Ref"
                      value={prescriptionRef}
                      onChange={e => setPrescriptionRef(e.target.value)}
                      className="text-sm"
                    />
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
                                  {res.RequiresPrescription && <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Rx</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">{res.GenericName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₹ {res.Batches[0].UnitPrice.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">Stock: {res.Batches[0].AvailableStock}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Popular Suggestions */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Popular Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {["Paracetamol 500mg", "Amoxicillin 250mg", "Cetirizine 10mg", "Ibuprofen 400mg", "Omeprazole 20mg"].map(pill => (
                      <button
                        key={pill}
                        onClick={() => handleSearch(pill)}
                        className="px-3 py-1.5 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs rounded-full border border-border transition-colors whitespace-nowrap"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
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
                        <th className="px-3 py-3 font-semibold text-right">Discount</th>
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
                              {item.RequiresPrescription && <span className="ml-2 text-[10px] text-rose-500 font-bold">Rx</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.BatchCode}</td>
                            <td className="px-3 py-3 text-center text-muted-foreground text-xs">{item.AvailableStock}</td>
                            <td className="px-3 py-3 text-right">₹ {item.UnitPrice.toFixed(2)}</td>
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
                                className="h-8 w-20 text-right mx-auto"
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
                            <td className="px-3 py-3 text-right font-bold">₹ {item.LineTotal.toFixed(2)}</td>
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
                    <span className="font-medium text-foreground">₹ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-medium text-rose-500">- ₹ {totalDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({taxRate}%)</span>
                    <span className="font-medium text-foreground">₹ {totalTax.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-dashed border-border my-4 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">Grand Total</span>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-3 bg-secondary/30 p-3 rounded-lg border border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-muted-foreground">Paid Amount</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-medium">₹</span>
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
                      <span className="font-bold text-emerald-600 dark:text-emerald-500 text-lg">₹ {changeDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-rose-600 dark:text-rose-500">Remaining Bal.</span>
                      <span className="font-bold text-rose-600 dark:text-rose-500">₹ {remainingBalance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button id="complete-sale-btn" onClick={handleCompleteSale} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-500/20" disabled={cart.length === 0}>
                    Complete Sale <span className="ml-2 text-[10px] bg-blue-500 px-1 rounded border border-blue-400">F10</span> <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md">
                    <Printer className="mr-2 w-4 h-4" /> Save & Print
                  </Button>
                  <Button variant="outline" className="w-full h-11 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 font-medium">
                    <Pause className="mr-2 w-4 h-4" /> Hold Sale
                  </Button>
                  <Button variant="outline" onClick={() => setCart([])} className="w-full h-11 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 font-medium">
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
            <div className="flex gap-4 mb-6">
              <Input
                placeholder="Enter Invoice Number (e.g. INV-2608-0001)"
                value={returnInvoiceNo}
                onChange={(e) => setReturnInvoiceNo(e.target.value.toUpperCase())}
                className="max-w-xs uppercase font-mono"
              />
              <Button onClick={handleFetchReturnInvoice} className="bg-slate-800 text-white hover:bg-slate-900 shadow">Lookup Invoice</Button>
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
                    <p className="font-bold text-foreground">₹{returnInvoiceData.GrandTotal.toFixed(2)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                    <thead className="bg-secondary/50 border-b border-border">
                      <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                        <th className="px-3 py-3 font-semibold">Medicine</th>
                        <th className="px-3 py-3 font-semibold">Batch</th>
                        <th className="px-3 py-3 font-semibold text-center">Sold Qty</th>
                        <th className="px-3 py-3 font-semibold text-center text-rose-500">Returned</th>
                        <th className="px-3 py-3 font-semibold text-center w-28">Return Qty</th>
                        <th className="px-3 py-3 font-semibold w-64">Condition (Mandatory)</th>
                        <th className="px-3 py-3 font-semibold text-right">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {returnItems.map(item => {
                        const ratio = item.ReturnQuantity > 0 ? (item.ReturnQuantity / item.Quantity) : 0;
                        const refund = item.TotalPrice * ratio;
                        const isFullyReturned = item.Quantity === item.ReturnedQuantity;

                        return (
                          <tr key={item.SalesItemId} className={isFullyReturned ? "opacity-50 bg-secondary/20" : "hover:bg-secondary/10"}>
                            <td className="px-3 py-3 font-medium text-foreground">{item.MedicineName}</td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.BatchCode}</td>
                            <td className="px-3 py-3 text-center">{item.Quantity}</td>
                            <td className="px-3 py-3 text-center text-rose-500 font-bold">{item.ReturnedQuantity}</td>
                            <td className="px-3 py-3 text-center">
                              <Input
                                type="number"
                                disabled={isFullyReturned}
                                min={0}
                                max={item.Quantity - item.ReturnedQuantity}
                                value={item.ReturnQuantity === 0 ? "" : item.ReturnQuantity}
                                onChange={(e) => updateReturnItem(item.SalesItemId, 'ReturnQuantity', parseInt(e.target.value) || 0)}
                                className="w-16 text-center h-8 mx-auto"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                disabled={isFullyReturned || item.ReturnQuantity === 0}
                                value={item.ItemCondition}
                                onChange={(e) => updateReturnItem(item.SalesItemId, 'ItemCondition', e.target.value)}
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                              >
                                <option value="Restockable">Restockable (Return to Shelf)</option>
                                <option value="Damaged/Quarantine">Damaged/Quarantine (Write-off)</option>
                              </select>
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-600">₹{refund.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-50 dark:bg-card border border-border rounded-lg p-6">
                  <div className="flex-1 w-full">
                    <label className="text-sm font-semibold mb-2 block text-foreground">Return Reason (Mandatory) <span className="text-rose-500">*</span></label>
                    <textarea
                      placeholder="e.g. Expired, Adverse Reaction, Wrong Item Dispensed..."
                      className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-muted-foreground mb-1">Total Refund to Customer</p>
                    <p className="text-4xl font-bold text-rose-600 mb-4">₹{totalRefundPreview.toFixed(2)}</p>
                    <Button onClick={handleSubmitReturn} size="lg" className="w-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg">
                      Process Refund <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sales History Grid */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Sales History</h2>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 bg-secondary/30 p-4 rounded-lg border border-border">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Search Invoice / Customer</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-9"
                    value={historyFilters.q}
                    onChange={e => setHistoryFilters({ ...historyFilters, q: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={historyFilters.startDate}
                  onChange={e => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={historyFilters.endDate}
                  onChange={e => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={historyFilters.paymentMethod}
                  onChange={e => setHistoryFilters({ ...historyFilters, paymentMethod: e.target.value })}
                >
                  <option value="">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchHistory} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Apply Filters</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Invoice No</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Cashier</th>
                    <th className="px-3 py-3 font-semibold text-right">Total Amount</th>
                    <th className="px-3 py-3 font-semibold text-center">Status</th>
                    <th className="px-3 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingHistory ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading history...</td></tr>
                  ) : historyItems.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found matching criteria.</td></tr>
                  ) : (
                    historyItems.map(item => (
                      <tr key={item.SalesId} className="hover:bg-secondary/10">
                        <td className="px-3 py-3 font-medium text-muted-foreground">{item.TransactionDate}</td>
                        <td className="px-3 py-3 font-mono font-bold text-foreground">{item.InvoiceNumber}</td>
                        <td className="px-3 py-3">{item.CustomerName}</td>
                        <td className="px-3 py-3 text-xs">{item.CashierName}</td>
                        <td className="px-3 py-3 text-right font-bold">₹{item.GrandTotal.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            item.Status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                              item.Status === "Partially Returned" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                                "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                          )}>
                            {item.Status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:hover:bg-blue-950/30"
                            onClick={() => handleReprint(item.InvoiceNumber, item.CashierName, item.PaymentMethod)}
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" /> Reprint
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
      </div>

      {/* Footer Shortcuts */}
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
        <div className="ml-auto flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <Barcode className="w-5 h-5" />
          <span className="font-medium">Barcode Scanner Ready</span>
        </div>
      </div>

      {/* Prescription Modal */}
      {prescriptionPromptObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md border border-border">
            <h2 className="text-xl font-bold text-rose-600 mb-2 flex items-center gap-2">
              ⚠️ Prescription Required
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              <strong>{prescriptionPromptObj.MedicineName}</strong> requires a valid prescription before it can be dispensed. Please enter the prescription reference or doctor details.
            </p>
            <Input
              autoFocus
              placeholder="e.g. Dr. Smith / RX-7742"
              className="mb-6"
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmPrescription((e.target as HTMLInputElement).value || 'Verified');
              }}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPrescriptionPromptObj(null)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => confirmPrescription(document.querySelector<HTMLInputElement>('input[placeholder="e.g. Dr. Smith / RX-7742"]')?.value || 'Verified')}>
                Confirm Dispense
              </Button>
            </div>
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
                        <span>{item.Quantity} x ₹{item.UnitPrice.toFixed(2)}</span>
                        <span>₹{item.LineTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 mb-4 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{completedReceipt.SubTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>- ₹{completedReceipt.Discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm mt-2">
                    <span>GRAND TOTAL:</span>
                    <span>₹{completedReceipt.GrandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 mb-6 space-y-1">
                  <div className="flex justify-between">
                    <span>Paid:</span>
                    <span>₹{completedReceipt.PaidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change Due:</span>
                    <span>₹{completedReceipt.ChangeDue.toFixed(2)}</span>
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
    </div>
  );
}
