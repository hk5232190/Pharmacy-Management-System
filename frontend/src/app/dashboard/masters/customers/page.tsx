"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Download, Upload, Eye, Edit, Trash2, AlertCircle, Users, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiClient, API_BASE_URL } from "@/lib/api-client";
import { toast } from "sonner";

interface Customer {
  CustomerId: number;
  Name: string;
  Phone?: string;
  Address?: string;
  LoyaltyPoints: number;
  IsActive: boolean;
  BalanceDue: number;
}

const formatCurrency = (amount: number) => {
  if (!amount || amount === 0) return "Rs 0";
  return `Rs ${amount.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

type BalanceFilter = "all" | "paid" | "due";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [currentItem, setCurrentItem] = useState<Partial<Customer>>({ Name: "", Phone: "", Address: "", LoyaltyPoints: 0, IsActive: true });
  const [itemToDelete, setItemToDelete] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (search) params.append("search", search);
      if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);
      if (balanceFilter && balanceFilter !== "all") params.append("balance_filter", balanceFilter);
      const res = await apiClient.get<any>(`/customers?${params.toString()}`);
      if (res.success !== false) { setCustomers(res.data || []); setTotalRecords(res.total || 0); }
    } catch { toast.error("Failed to load customers"); }
    finally { setLoading(false); }
  }, [page, pageSize, search, filterStatus, balanceFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchCustomers, search]);

  const openNewDialog = () => { setCurrentItem({ Name: "", Phone: "", Address: "", LoyaltyPoints: 0, IsActive: true }); setIsDialogOpen(true); };
  const openEditDialog = (c: Customer) => { setCurrentItem({ ...c }); setIsDialogOpen(true); };
  const openViewDialog = (c: Customer) => { setCurrentItem({ ...c }); setIsViewDialogOpen(true); };
  const openDeleteDialog = (c: Customer) => { setItemToDelete(c); setIsDeleteDialogOpen(true); };

  const handleSave = async () => {
    if (!currentItem.Name?.trim()) return toast.error("Customer name is required");
    setIsSaving(true);
    try {
      const isEdit = !!(currentItem as Customer).CustomerId;
      const payload = { Name: currentItem.Name, Phone: currentItem.Phone || null, Address: currentItem.Address || null, LoyaltyPoints: currentItem.LoyaltyPoints || 0, IsActive: currentItem.IsActive ?? true };
      if (isEdit) { await apiClient.put(`/customers/${(currentItem as Customer).CustomerId}`, payload); toast.success("Customer updated successfully"); }
      else { await apiClient.post("/customers", payload); toast.success("Customer created successfully"); }
      setIsDialogOpen(false); fetchCustomers();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed to save customer"); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/customers/${itemToDelete.CustomerId}`);
      toast.success("Customer deleted successfully"); setIsDeleteDialogOpen(false); fetchCustomers();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed to delete customer"); }
    finally { setIsDeleting(false); }
  };

  const handleToggleStatus = async (id: number) => {
    try { await apiClient.put(`/customers/${id}/status`, {}); fetchCustomers(); }
    catch { toast.error("Failed to toggle status"); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/customers/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "customers_export.csv"; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
    finally { setIsExporting(false); }
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fname = file.name.toLowerCase();
    if (!fname.endsWith('.csv') && !fname.endsWith('.xlsx') && !fname.endsWith('.xls')) {
      toast.error("Invalid file type. Please upload a CSV (.csv) or Excel (.xlsx / .xls) file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData(); formData.append("file", file);
      const res = await apiClient.post<any>("/customers/import", formData);
      const imported = res.data?.imported_count ?? 0;
      const skipped = res.data?.skipped_count ?? 0;
      toast.success(`Import complete — ${imported} added, ${skipped} skipped.`);
      fetchCustomers();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Import failed"); }
    finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers by name or phone..." className="pl-9 h-10 w-full bg-background border-border" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={openNewDialog} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold"><Plus className="mr-2 h-4 w-4" /> Add New</Button>
          <input type="file" accept=".csv, .xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleImportClick} disabled={isImporting}><Download className="mr-2 h-4 w-4" /> {isImporting ? "Importing..." : "Import"}</Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleExport} disabled={isExporting}><Upload className="mr-2 h-4 w-4" /> {isExporting ? "Exporting..." : "Export"}</Button>
        </div>
      </div>

      {/* Balance Filter Tabs */}
      <div className="px-4 pt-0 flex items-center gap-0 border-b border-border bg-background">
        {([
          { key: "all", label: "All Customers", icon: Users },
          { key: "paid", label: "Fully Paid", icon: CheckCircle2 },
          { key: "due", label: "Balance Due", icon: Clock },
        ] as { key: BalanceFilter; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setBalanceFilter(key); setPage(1); }}
            className={cn("flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              balanceFilter === key
                ? key === "due" ? "border-rose-500 text-rose-600 dark:text-rose-400" : "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <Icon className={cn("h-4 w-4", key === "due" && balanceFilter === key && "text-rose-500")} />
            {label}
            {key === "due" && !loading && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                {customers.filter(c => c.BalanceDue > 0).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-secondary/50 text-left">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-10 text-center">#</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-28 text-left">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left">Customer Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-36 text-left">Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left">Address</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-36 text-center">Balance Due</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-28 text-center">Loyalty</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-24 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center pr-6 w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">Loading customers...</TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  {balanceFilter === "due" ? "No customers with outstanding balance." : "No customers found."}
                </TableCell></TableRow>
              ) : (
                customers.map((customer, idx) => (
                  <TableRow key={customer.CustomerId} className={cn("hover:bg-secondary/50 transition-colors h-14", customer.BalanceDue > 0 && "bg-rose-50/30 dark:bg-rose-950/10")}>
                    <TableCell className="text-center py-3 text-muted-foreground font-medium text-[14px]">{(page - 1) * pageSize + idx + 1}</TableCell>
                    <TableCell className="py-3 font-mono text-[13px] font-semibold text-foreground text-left">CUST-{customer.CustomerId.toString().padStart(5, "0")}</TableCell>
                    <TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px] text-left">
                      {customer.Name}
                      {customer.BalanceDue > 0 && <AlertCircle className="inline ml-1.5 h-3.5 w-3.5 text-rose-500 align-middle" />}
                    </TableCell>
                    <TableCell className="py-3 text-foreground text-[14px] text-left">{customer.Phone || "?"}</TableCell>
                    <TableCell className="py-3 text-foreground text-[14px] max-w-[180px] truncate text-left" title={customer.Address || ""}>{customer.Address || "?"}</TableCell>
                    <TableCell className="text-center py-3">
                      {customer.BalanceDue > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
                          {formatCurrency(customer.BalanceDue)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Paid
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{customer.LoyaltyPoints} pts</span>
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <button onClick={() => handleToggleStatus(customer.CustomerId)} disabled={customer.CustomerId === 0}
                        className={cn("px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          customer.IsActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200",
                          customer.CustomerId === 0 && "opacity-50 cursor-not-allowed"
                        )}>
                        {customer.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-center pr-6 py-3">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button onClick={() => openViewDialog(customer)} className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(customer)} disabled={customer.CustomerId === 0} className={cn("hover:text-blue-500 transition-colors", customer.CustomerId === 0 && "opacity-30 cursor-not-allowed")}><Edit className="h-4 w-4" /></button>
                        <button onClick={() => openDeleteDialog(customer)} disabled={customer.CustomerId === 0} className={cn("hover:text-rose-500 transition-colors", customer.CustomerId === 0 && "opacity-30 cursor-not-allowed")}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && totalRecords > 0 && (
          <div className="flex items-center justify-between gap-4 mt-4 px-2 py-2 text-sm text-muted-foreground border border-border rounded-lg bg-background">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, totalRecords)} of {totalRecords}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 px-3" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                <Button variant="outline" size="sm" className="h-8 px-3" disabled={page * pageSize >= totalRecords} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{(currentItem as Customer).CustomerId ? "Edit Customer" : "Add New Customer"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><label className="text-sm font-semibold text-foreground">Customer Name <span className="text-rose-500">*</span></label>
              <Input value={(currentItem as Customer).Name || ""} onChange={e => setCurrentItem(p => ({ ...p, Name: e.target.value }))} placeholder="e.g. John Doe" className="h-11" /></div>
            <div className="space-y-2"><label className="text-sm font-semibold text-foreground">Mobile / Phone <span className="text-muted-foreground font-normal">(Required for credit)</span></label>
              <Input value={(currentItem as Customer).Phone || ""} onChange={e => setCurrentItem(p => ({ ...p, Phone: e.target.value }))} placeholder="e.g. 0300-1234567" className="h-11" /></div>
            <div className="space-y-2"><label className="text-sm font-semibold text-foreground">Address / Area <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <Input value={(currentItem as Customer).Address || ""} onChange={e => setCurrentItem(p => ({ ...p, Address: e.target.value }))} placeholder="e.g. DHA Phase 5" className="h-11" /></div>
            {(currentItem as Customer).CustomerId !== undefined && (
              <div className="space-y-2"><label className="text-sm font-semibold text-foreground">Loyalty Points</label>
                <Input type="number" value={(currentItem as Customer).LoyaltyPoints} onChange={e => setCurrentItem(p => ({ ...p, LoyaltyPoints: parseInt(e.target.value) || 0 }))} className="h-11" /></div>
            )}
            <div className="space-y-2"><label className="text-sm font-semibold text-foreground">Status</label>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", (currentItem as Customer).IsActive ? "bg-emerald-500" : "bg-rose-500")} />
                  <span className={cn("text-sm font-semibold", (currentItem as Customer).IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>{(currentItem as Customer).IsActive ? "Active" : "Inactive"}</span>
                </div>
                <button type="button" role="switch" aria-checked={(currentItem as Customer).IsActive} onClick={() => setCurrentItem(p => ({ ...p, IsActive: !(p as Customer).IsActive }))}
                  className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200", (currentItem as Customer).IsActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
                  <span className={cn("pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200", (currentItem as Customer).IsActive ? "translate-x-5" : "translate-x-0")} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving..." : "Save Customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Customer Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {(currentItem as Customer).BalanceDue > 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <div><p className="text-sm font-bold text-rose-700 dark:text-rose-400">Outstanding Balance</p>
                  <p className="text-lg font-bold text-rose-600">{formatCurrency((currentItem as Customer).BalanceDue)}</p></div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">No outstanding balance ? fully paid</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Customer Code</p>
                <p className="font-mono text-sm font-semibold">CUST-{(currentItem as Customer).CustomerId?.toString().padStart(5, "0")}</p></div>
              <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Status</p>
                <span className={cn("px-3 py-1 text-[13px] font-bold rounded-full", (currentItem as Customer).IsActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400")}>
                  {(currentItem as Customer).IsActive ? "Active" : "Inactive"}</span></div>
            </div>
            <div className="space-y-1 pt-2 border-t border-border"><p className="text-sm font-medium text-muted-foreground">Customer Name</p><p className="text-base font-semibold">{(currentItem as Customer).Name}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Mobile / Phone</p><p className="text-sm">{(currentItem as Customer).Phone || "N/A"}</p></div>
              <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Address</p><p className="text-sm">{(currentItem as Customer).Address || "N/A"}</p></div>
            </div>
            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Loyalty Points</p><p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{(currentItem as Customer).LoyaltyPoints} pts</p></div>
          </div>
          <DialogFooter><Button onClick={() => setIsViewDialogOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-rose-500/20">
          <DialogHeader><DialogTitle className="text-rose-600 flex items-center gap-2"><Trash2 className="h-5 w-5" /> Confirm Deletion</DialogTitle></DialogHeader>
          <div className="py-4 text-foreground/80">
            <p>Are you absolutely sure you want to delete <strong>{itemToDelete?.Name}</strong>?</p>
            {itemToDelete && itemToDelete.BalanceDue > 0 && (
              <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <p className="text-sm text-rose-700 dark:text-rose-400">Outstanding balance of <strong>{formatCurrency(itemToDelete.BalanceDue)}</strong> ? deletion will be blocked.</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">This action is irreversible.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white">{isDeleting ? "Deleting..." : "Confirm Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


