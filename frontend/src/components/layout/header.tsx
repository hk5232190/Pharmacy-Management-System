"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Bell, Calendar, User, Search, X, LayoutDashboard, ShoppingCart, Package, TrendingUp, BarChart3, Settings, Pill, Grid2X2, Building2, Truck, Users, Database } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";

const SEARCH_ITEMS = [
  { title: "Dashboard", desc: "Overview & analytics", icon: LayoutDashboard, href: "/dashboard", category: "Pages" },
  { title: "Medicines", desc: "Manage medicine catalog", icon: Pill, href: "/dashboard/masters/medicines", category: "Master Data" },
  { title: "Categories", desc: "Medicine categories", icon: Grid2X2, href: "/dashboard/masters/categories", category: "Master Data" },
  { title: "Companies", desc: "Pharmaceutical companies", icon: Building2, href: "/dashboard/masters/companies", category: "Master Data" },
  { title: "Suppliers", desc: "Manage suppliers", icon: Truck, href: "/dashboard/masters/suppliers", category: "Master Data" },
  { title: "Customers", desc: "Customer records", icon: Users, href: "/dashboard/masters/customers", category: "Master Data" },
  { title: "Purchases", desc: "Purchase orders & invoices", icon: ShoppingCart, href: "/dashboard/purchases", category: "Pages" },
  { title: "Inventory", desc: "Stock & inventory tracking", icon: Package, href: "/dashboard/inventory", category: "Pages" },
  { title: "Sales & POS Billing", desc: "Point of sale & billing", icon: TrendingUp, href: "/dashboard/sales", category: "Pages" },
  { title: "Reports", desc: "Analytics & export reports", icon: BarChart3, href: "/dashboard/reports", category: "Pages" },
  { title: "Backup & Restore", desc: "Database backup", icon: Database, href: "/dashboard/backup", category: "Pages" },
  { title: "Settings", desc: "System preferences", icon: Settings, href: "/dashboard/settings", category: "Pages" },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

export function Header() {
  const router = useRouter();
  const { profile } = useProfile();
  const { formatDate } = useSystemPreferences();
  const [currentDate, setCurrentDate] = useState("");
  const [currentDayName, setCurrentDayName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setGreeting(getGreeting());
      setCurrentDate(formatDate(now));
      setCurrentDayName(now.toLocaleDateString('en-US', { weekday: 'long' }));
    };
    
    updateTime(); // Initial call
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [formatDate]);

  const filtered = query.trim().length > 0
    ? SEARCH_ITEMS.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.desc.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_ITEMS;

  const navigate = useCallback((href: string) => {
    router.push(href);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  }, [router]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[activeIdx]) { navigate(filtered[activeIdx].href); }
    if (e.key === "Escape")    { setFocused(false); setQuery(""); }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    router.push("/");
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border shadow-sm shrink-0 z-40">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex flex-col shrink-0">
          <span className="font-bold text-[15px] text-foreground leading-tight">{greeting || "Welcome"}, Admin!</span>
          <span className="text-[11px] text-muted-foreground font-medium">{profile.PharmacyName || "Pharmacy"}</span>
        </div>
        <div className="w-[1px] h-8 bg-border hidden sm:block shrink-0" />
        <div ref={dropdownRef} className="relative w-full max-w-sm hidden sm:block">
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 bg-background ${focused ? "border-primary ring-2 ring-primary/15 shadow-lg" : "border-border hover:border-primary/40 dark:hover:border-slate-500"}`}>
            <Search className={`w-4 h-4 shrink-0 transition-colors duration-200 ${focused ? "text-primary" : "text-muted-foreground"}`} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, medicines, reports..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none min-w-0"
            />
            {query ? (
              <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden lg:flex items-center text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-mono border border-border shrink-0 select-none">
                /
              </kbd>
            )}
          </div>
          {focused && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                  </div>
                ) : (
                  ["Pages", "Master Data"].map(cat => {
                    const items = filtered.filter(i => i.category === cat);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 select-none">{cat}</div>
                        {items.map((item) => {
                          const globalIdx = filtered.indexOf(item);
                          const Icon = item.icon;
                          const isActive = activeIdx === globalIdx;
                          return (
                            <button
                              key={item.href}
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIdx(globalIdx)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isActive ? "bg-primary/10" : "hover:bg-secondary"}`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className={`text-sm font-medium leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>{item.title}</span>
                                <span className="text-xs text-muted-foreground truncate">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="px-3 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground/60 bg-muted/30 select-none">
                <span><kbd className="bg-background border border-border rounded px-1 font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="bg-background border border-border rounded px-1 font-mono">↵</kbd> open</span>
                <span><kbd className="bg-background border border-border rounded px-1 font-mono">Esc</kbd> close</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {currentDate && (
          <div className="hidden lg:flex items-center gap-3 text-sm text-muted-foreground bg-secondary/50 px-4 py-1.5 rounded-lg border border-border">
            <Calendar className="w-5 h-5 text-primary/70" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-foreground text-[13px]">{currentDate}</span>
              <span className="text-[11px] font-medium">{currentDayName}</span>
            </div>
          </div>
        )}
        <ThemeToggle />
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
          <Bell className="w-[1.2rem] h-[1.2rem]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-card" />
        </button>
        <div className="w-[1px] h-6 bg-border mx-0.5" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 hover:bg-secondary p-1.5 pr-3 rounded-full transition-colors outline-none focus:ring-2 focus:ring-primary/20">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <User size={16} />
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">Admin</span>
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuItem className="text-sm cursor-pointer py-2">
              <User className="mr-2 w-4 h-4 text-slate-500" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm cursor-pointer py-2">
              <LockIcon className="mr-2 w-4 h-4 text-slate-500" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm cursor-pointer py-2">
              <InfoIcon className="mr-2 w-4 h-4 text-slate-500" /> About Software
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-sm cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive py-2">
              <LogOutIcon className="mr-2 w-4 h-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ChevronDownIcon(props: any) {
  return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>);
}
function LockIcon(props: any) {
  return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
}
function InfoIcon(props: any) {
  return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>);
}
function LogOutIcon(props: any) {
  return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>);
}
