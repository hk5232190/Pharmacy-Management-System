"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  ArrowRight,
  Zap,
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Package,
  Pill,
  BarChart3,
  Users,
  Truck,
  FileText,
  Settings,
  Grid2X2,
  Building2,
  Database,
  RefreshCcw,
  PackageCheck,
  Undo2,
  AlertTriangle,
  Clock,
  ArrowLeftRight,
  SlidersHorizontal,
  ShoppingBag,
  PackageSearch,
  CircleDollarSign,
  Receipt,
  Sliders,
  Printer,
  ShieldCheck,
  UserCheck,
  Activity,
  Info,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface SearchResultItem {
  id: string;
  category: "quick" | "pages" | "medicines" | "customers" | "suppliers" | "invoices_reports";
  categoryLabel: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "destructive" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  href: string;
}

// ─── App Pages Catalog (For Pages Category) ─────────────────────────────────
const PAGE_ITEMS: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  module?: string;
  keywords: string[];
}[] = [
  { title: "Dashboard", desc: "Overview, revenue & KPIs", icon: LayoutDashboard, href: "/dashboard", module: "dashboard", keywords: ["analytics", "home", "metrics"] },
  { title: "Sales & POS Billing", desc: "Point of Sale checkout", icon: TrendingUp, href: "/dashboard/sales", module: "sales", keywords: ["pos", "bill", "invoice", "checkout", "counter"] },
  { title: "Sales History", desc: "View & reprint past invoices", icon: FileText, href: "/dashboard/sales?tab=history", module: "sales", keywords: ["past sales", "invoices", "receipts"] },
  { title: "Sales Return", desc: "Process refunds & credit returns", icon: RefreshCcw, href: "/dashboard/sales?tab=return", module: "sales", keywords: ["refund", "customer return"] },
  { title: "Purchases", desc: "Supplier invoices & orders", icon: ShoppingCart, href: "/dashboard/purchases", module: "purchases", keywords: ["supplier bill", "po", "procurement"] },
  { title: "New Purchase Invoice", desc: "Record incoming stock & bill", icon: PackageCheck, href: "/dashboard/purchases/new", module: "purchases", keywords: ["purchase entry", "add stock"] },
  { title: "Purchase Returns", desc: "Debit notes & supplier returns", icon: Undo2, href: "/dashboard/purchases?tab=returns", module: "purchases", keywords: ["supplier return", "debit note"] },
  { title: "Inventory", desc: "Current stock valuation & batches", icon: Package, href: "/dashboard/inventory", module: "inventory", keywords: ["stock", "batches", "valuation"] },
  { title: "Low Stock Alerts", desc: "Medicines below reorder level", icon: AlertTriangle, href: "/dashboard/inventory?tab=current&status=Low%20Stock", module: "inventory", keywords: ["reorder", "shortage", "low stock"] },
  { title: "Expiry Tracker", desc: "Expired & approaching expiry", icon: Clock, href: "/dashboard/inventory?tab=expiry", module: "inventory", keywords: ["expiration", "near expiry", "expired"] },
  { title: "Stock Movements", desc: "Audit trail of stock ins/outs", icon: ArrowLeftRight, href: "/dashboard/inventory?tab=movement", module: "inventory", keywords: ["ledger", "flow", "audit trail"] },
  { title: "Stock Adjustments", desc: "Manual quantity corrections", icon: SlidersHorizontal, href: "/dashboard/inventory?tab=adjustments", module: "inventory", keywords: ["damage", "audit correction", "adjustment"] },
  { title: "Medicines Catalog", desc: "Master list of medicines", icon: Pill, href: "/dashboard/masters/medicines", module: "medicines", keywords: ["products", "drugs", "items", "brands"] },
  { title: "Categories", desc: "Medicine therapeutic categories", icon: Grid2X2, href: "/dashboard/masters/categories", module: "medicines", keywords: ["groups", "classification"] },
  { title: "Companies", desc: "Pharmaceutical manufacturers", icon: Building2, href: "/dashboard/masters/companies", module: "medicines", keywords: ["brands", "manufacturers", "pharma"] },
  { title: "Suppliers", desc: "Vendor records & balances", icon: Truck, href: "/dashboard/masters/suppliers", module: "suppliers", keywords: ["vendors", "distributors", "creditors"] },
  { title: "Customers", desc: "Customer accounts & dues", icon: Users, href: "/dashboard/masters/customers", module: "customers", keywords: ["patients", "clients", "receivables", "balance due"] },
  { title: "Reports", desc: "Business intelligence hub", icon: BarChart3, href: "/dashboard/reports", module: "reports", keywords: ["charts", "export", "analytics"] },
  { title: "Sales Report", desc: "Revenue & profit analysis", icon: BarChart3, href: "/dashboard/reports?tab=sales", module: "reports", keywords: ["sales analytics", "revenue report"] },
  { title: "Purchases Report", desc: "Procurement expenses & dues", icon: ShoppingBag, href: "/dashboard/reports?tab=purchases", module: "reports", keywords: ["expense report", "vendor spend"] },
  { title: "Inventory Report", desc: "Stock valuation & turnover", icon: PackageSearch, href: "/dashboard/reports?tab=inventory", module: "reports", keywords: ["valuation report", "cogs"] },
  { title: "Financial Report", desc: "P&L, gross & net margins", icon: CircleDollarSign, href: "/dashboard/reports?tab=financial", module: "reports", keywords: ["profit loss", "net income", "p&l"] },
  { title: "Backup & Restore", desc: "Manual & automatic backups", icon: Database, href: "/dashboard/settings/backup-restore", module: "settings", keywords: ["export db", "snapshot", "restore", "backup"] },
  { title: "Settings", desc: "Pharmacy system configuration", icon: Settings, href: "/dashboard/settings", module: "settings", keywords: ["configuration", "preferences"] },
  { title: "Billing Settings", desc: "Taxes, discounts & invoice footer", icon: Receipt, href: "/dashboard/settings/billing", module: "settings", keywords: ["tax", "discount", "invoice settings", "billing"] },
  { title: "Inventory Settings", desc: "Reorder levels & expiry days", icon: Sliders, href: "/dashboard/settings/inventory", module: "settings", keywords: ["threshold", "expiry alert", "low stock setting"] },
  { title: "Printer Settings", desc: "Receipt printer & ESC/POS port", icon: Printer, href: "/dashboard/settings/printer", module: "settings", keywords: ["thermal printer", "pos printer", "receipt printer"] },
  { title: "Security Settings", desc: "PIN protection & session timeout", icon: ShieldCheck, href: "/dashboard/settings/security", module: "settings", keywords: ["admin pin", "lock", "password", "security"] },
  { title: "User Management", desc: "Manage cashier & admin accounts", icon: UserCheck, href: "/dashboard/settings/users", module: "settings", keywords: ["staff", "cashiers", "roles", "users"] },
  { title: "System Diagnostics", desc: "Backend health & database stats", icon: Activity, href: "/dashboard/settings/diagnostics", module: "settings", keywords: ["health", "logs", "status", "diagnostics"] },
  { title: "About Software", desc: "Version & licensing information", icon: Info, href: "/dashboard/settings/about", keywords: ["license", "support", "version", "about"] },
];

export function GlobalSearch() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  // Live entity state
  const [medicines, setMedicines] = useState<SearchResultItem[]>([]);
  const [customers, setCustomers] = useState<SearchResultItem[]>([]);
  const [suppliers, setSuppliers] = useState<SearchResultItem[]>([]);
  const [invoices, setInvoices] = useState<SearchResultItem[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);



  // Filtered Pages matching query
  const matchingPages: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PAGE_ITEMS.filter((item) => {
      if (item.module && !hasPermission(item.module)) return false;
      if (user.role === "cashier" && item.module && item.module !== "sales") return false;
      const titleMatch = item.title.toLowerCase().includes(q);
      const descMatch = item.desc.toLowerCase().includes(q);
      const kwMatch = item.keywords.some((k) => k.toLowerCase().includes(q));
      return titleMatch || descMatch || kwMatch;
    })
      .slice(0, 4)
      .map((item) => ({
        id: `page-${item.href}`,
        category: "pages",
        categoryLabel: "Pages",
        title: item.title,
        subtitle: item.desc,
        badge: "Page",
        icon: item.icon,
        iconBgColor: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
        href: item.href,
      }));
  }, [query, user.role, hasPermission]);

  // Report items for "Invoices / Reports" category if query matches report terms
  const matchingReports: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const reportKeywords = ["report", "analytics", "summary", "profit", "loss", "p&l", "tax", "turnover", "cogs"];
    const matchesKeyword = reportKeywords.some((k) => k.includes(q) || q.includes(k));
    if (!matchesKeyword) return [];

    const reports = [
      { title: "Sales Report", desc: "Detailed sales revenue & gross margin", tab: "sales", match: "sales" },
      { title: "Purchases Report", desc: "Supplier bills, procurement & dues", tab: "purchases", match: "purchase" },
      { title: "Inventory Valuation Report", desc: "Stock batches, cost & potential retail", tab: "inventory", match: "inventory" },
      { title: "Financial P&L Report", desc: "Net profit, margins & business trend", tab: "financial", match: "financial" },
    ];

    return reports
      .filter((r) => {
        if (!hasPermission("reports")) return false;
        if (q.includes("report") || q.includes("summary") || q.includes("analytics")) return true;
        return r.title.toLowerCase().includes(q) || r.match.includes(q);
      })
      .slice(0, 2)
      .map((r) => ({
        id: `rep-${r.tab}`,
        category: "invoices_reports",
        categoryLabel: "Invoices & Reports",
        title: r.title,
        subtitle: r.desc,
        badge: "Report",
        icon: BarChart3,
        iconBgColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
        href: `/dashboard/reports?tab=${r.tab}`,
      }));
  }, [query, hasPermission]);

  // Combined Invoices + Reports
  const combinedInvoicesAndReports: SearchResultItem[] = useMemo(() => {
    return [...invoices, ...matchingReports].slice(0, 4);
  }, [invoices, matchingReports]);

  // Grouped active categories
  const categories: { key: string; label: string; items: SearchResultItem[] }[] = useMemo(() => {
    if (!query.trim()) {
      return [];
    }

    const groups: { key: string; label: string; items: SearchResultItem[] }[] = [];
    if (matchingPages.length > 0) groups.push({ key: "pages", label: "Pages", items: matchingPages });
    if (medicines.length > 0) groups.push({ key: "medicines", label: "Medicines", items: medicines });
    if (customers.length > 0) groups.push({ key: "customers", label: "Customers", items: customers });
    if (suppliers.length > 0) groups.push({ key: "suppliers", label: "Suppliers", items: suppliers });
    if (combinedInvoicesAndReports.length > 0) {
      groups.push({ key: "invoices_reports", label: "Invoices & Reports", items: combinedInvoicesAndReports });
    }
    return groups;
  }, [query, matchingPages, medicines, customers, suppliers, combinedInvoicesAndReports]);

  // Flat list of all visible items for index-based keyboard navigation
  const flatItems: SearchResultItem[] = useMemo(() => {
    return categories.flatMap((c) => c.items);
  }, [categories]);

  // Reset active index when query or results change
  useEffect(() => {
    setActiveIdx(0);
  }, [query, flatItems.length]);

  // Debounced API Fetching across real database entities
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setMedicines([]);
      setCustomers([]);
      setSuppliers([]);
      setInvoices([]);
      setLoading(false);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(q);

        const [medsRes, custRes, suppRes, invRes] = await Promise.allSettled([
          apiClient.get<any>(`/medicines?search=${encoded}&page_size=4`),
          apiClient.get<any>(`/customers?search=${encoded}&page_size=4`),
          user.role !== "cashier" ? apiClient.get<any>(`/suppliers?search=${encoded}&page_size=4`) : Promise.resolve(null),
          apiClient.get<any>(`/sales/history?q=${encoded}&page_size=4`),
        ]);

        if (controller.signal.aborted) return;

        // Process Medicines
        if (medsRes.status === "fulfilled" && medsRes.value?.success && Array.isArray(medsRes.value?.data)) {
          const mappedMeds: SearchResultItem[] = medsRes.value.data.slice(0, 4).map((m: any) => ({
            id: `med-${m.MedicineId}`,
            category: "medicines",
            categoryLabel: "Medicines",
            title: m.BrandName,
            subtitle: [m.GenericName, m.DosageForm, m.Strength].filter(Boolean).join(" • ") || "Medicine item",
            badge: m.CategoryName || "Medicine",
            icon: Pill,
            iconBgColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            href: `/dashboard/masters/medicines?search=${encodeURIComponent(m.BrandName)}`,
          }));
          setMedicines(mappedMeds);
        } else {
          setMedicines([]);
        }

        // Process Customers
        if (custRes.status === "fulfilled" && custRes.value?.success && Array.isArray(custRes.value?.data)) {
          const mappedCust: SearchResultItem[] = custRes.value.data.slice(0, 4).map((c: any) => {
            const due = Number(c.BalanceDue || 0);
            return {
              id: `cust-${c.CustomerId}`,
              category: "customers",
              categoryLabel: "Customers",
              title: c.Name,
              subtitle: c.Phone || "Registered Customer",
              badge: due > 0 ? `Due: Rs. ${due.toLocaleString()}` : "Customer",
              badgeVariant: due > 0 ? "warning" : "default",
              icon: Users,
              iconBgColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              href: `/dashboard/masters/customers?search=${encodeURIComponent(c.Name)}`,
            };
          });
          setCustomers(mappedCust);
        } else {
          setCustomers([]);
        }

        // Process Suppliers
        if (suppRes.status === "fulfilled" && suppRes.value?.success && Array.isArray(suppRes.value?.data)) {
          const mappedSupp: SearchResultItem[] = suppRes.value.data.slice(0, 4).map((s: any) => {
            const bal = Number(s.CurrentBalance || 0);
            return {
              id: `supp-${s.SupplierId}`,
              category: "suppliers",
              categoryLabel: "Suppliers",
              title: s.Name,
              subtitle: s.ContactPerson ? `Contact: ${s.ContactPerson}` : (s.Phone || "Supplier Vendor"),
              badge: bal > 0 ? `Due: Rs. ${bal.toLocaleString()}` : "Supplier",
              icon: Truck,
              iconBgColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              href: `/dashboard/masters/suppliers?search=${encodeURIComponent(s.Name)}`,
            };
          });
          setSuppliers(mappedSupp);
        } else {
          setSuppliers([]);
        }

        // Process Invoices
        if (invRes.status === "fulfilled" && invRes.value?.success && Array.isArray(invRes.value?.data?.items)) {
          const mappedInv: SearchResultItem[] = invRes.value.data.items.slice(0, 4).map((sale: any) => {
            const amount = Number(sale.GrandTotal || sale.NetAmount || 0);
            return {
              id: `inv-${sale.SalesId}`,
              category: "invoices_reports",
              categoryLabel: "Invoices & Reports",
              title: sale.InvoiceNumber,
              subtitle: `${sale.CustomerName || "Walk-in"} • ${sale.TransactionDate || ""}`,
              badge: `Rs. ${amount.toLocaleString()}`,
              icon: FileText,
              iconBgColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
              href: `/dashboard/sales?tab=history&q=${encodeURIComponent(sale.InvoiceNumber)}`,
            };
          });
          setInvoices(mappedInv);
        } else {
          setInvoices([]);
        }
      } catch (err) {
        // Silently catch aborts
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      controller.abort();
    };
  }, [query, user.role]);

  // Navigate to target route
  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setQuery("");
      setFocused(false);
      inputRef.current?.blur();
    },
    [router]
  );

  // Smooth scroll into view when active index updates
  useEffect(() => {
    if (focused && itemRefs.current[activeIdx]) {
      itemRefs.current[activeIdx]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIdx, focused]);

  // Global key bindings: '/' and 'Ctrl+K' / 'Cmd+K' to focus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if ((e.key === "/" && !isInput) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIdx((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIdx((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[activeIdx]) {
        navigate(flatItems[activeIdx].href);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setFocused(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full max-w-sm lg:max-w-md hidden sm:block">
      {/* Search Input Box */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all duration-200 bg-background/80 backdrop-blur-xs",
          focused
            ? "border-primary ring-2 ring-primary/15 shadow-md bg-background"
            : "border-border hover:border-primary/40 dark:hover:border-slate-600"
        )}
      >
        <Search
          className={cn(
            "w-4 h-4 shrink-0 transition-colors duration-200",
            focused ? "text-primary" : "text-muted-foreground"
          )}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search pages, medicines, invoices, customers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none min-w-0"
        />

        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
        ) : query ? (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-1 select-none">
            <kbd className="hidden lg:flex items-center text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-mono border border-border shrink-0">
              /
            </kbd>
          </div>
        )}
      </div>

      {/* Dropdown Container */}
      {focused && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="max-h-[460px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
            {/* Empty State: No results matching query */}
            {query.trim().length > 0 && flatItems.length === 0 && !loading && (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                  <Search className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">No results found</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  No matches for &ldquo;<span className="font-medium text-foreground">{query}</span>&rdquo;. Try searching for medicine names, invoice numbers, or customers.
                </p>
              </div>
            )}

            {/* Categorized Results */}
            {categories.map((cat) => {
              if (cat.items.length === 0) return null;
              const isQuick = cat.key === "quick";

              return (
                <div key={cat.key} className="py-1">
                  {/* Category Header */}
                  <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75 flex items-center justify-between select-none bg-muted/30">
                    <span className="flex items-center gap-1.5">
                      {isQuick && <Zap className="w-3 h-3 text-amber-500 fill-amber-500/20" />}
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground/60 tabular-nums">
                      {isQuick ? "Jump to" : `${cat.items.length} ${cat.items.length === 1 ? "result" : "results"}`}
                    </span>
                  </div>

                  {/* Category Items */}
                  <div className="px-1.5 py-1 space-y-0.5">
                    {cat.items.map((item) => {
                      const globalIdx = flatItems.findIndex((i) => i.id === item.id);
                      const isActive = activeIdx === globalIdx;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          ref={(el) => {
                            itemRefs.current[globalIdx] = el;
                          }}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 text-left transition-all rounded-lg group",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-secondary/70 text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-xs"
                                  : item.iconBgColor || "bg-secondary text-muted-foreground"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span
                                className={cn(
                                  "text-xs font-semibold leading-tight truncate",
                                  isActive ? "text-primary" : "text-foreground"
                                )}
                              >
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            {item.badge && (
                              <span
                                className={cn(
                                  "text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/50",
                                  item.badgeVariant === "warning"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : item.badgeVariant === "success"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "text-muted-foreground/80 bg-muted/60"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                            <ArrowRight
                              className={cn(
                                "w-3 h-3 transition-transform duration-150",
                                isActive
                                  ? "text-primary translate-x-0.5 opacity-100"
                                  : "text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Shortcuts Help */}
          <div className="px-3.5 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground bg-muted/30 select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[10px] shadow-2xs">↑↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[10px] shadow-2xs">↵</kbd>
                <span>open</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[10px] shadow-2xs">esc</kbd>
                <span>close</span>
              </span>
            </div>
            {query.trim() && (
              <span className="text-[10px] font-medium text-muted-foreground/70">
                {flatItems.length} result{flatItems.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
