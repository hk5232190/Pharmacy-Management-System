"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Download, Upload, RefreshCcw, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface Customer {
  CustomerId: number;
  Name: string;
  Phone?: string;
  LoyaltyPoints: number;
  IsActive: boolean;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>({ Name: "", Phone: "", LoyaltyPoints: 0, IsActive: true });
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allSelected = customers.length > 0 && selectedIds.size === customers.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < customers.length;
  const toggleSelectAll = () => {
    if (allSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(customers.map(c => c.CustomerId))); }
  };
  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get("/customers", { params: search ? { search } : undefined });
      if (data.success) {
        setCustomers(data.data);
        setSelectedIds(new Set());
      } else {
        toast.error("Failed to load customers");
      }
    } catch (error) {
      toast.error("Network error while loading customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/customers/${id}/status`, { method: "PUT" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCustomers(customers.map(c => c.CustomerId === id ? { ...c, IsActive: !c.IsActive } : c));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentCustomer.Name?.trim()) {
      toast.error("Customer name is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const isEditing = !!currentCustomer.CustomerId;
      const url = isEditing 
        ? `/customers/${currentCustomer.CustomerId}`
        : `/customers`;
      
      const data = isEditing 
        ? await apiClient.put(url, currentCustomer)
        : await apiClient.post(url, currentCustomer);
      
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchCustomers(); // Reload list
      } else {
        toast.error(data.error || "Failed to save customer");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const openNewDialog = () => {
    setCurrentCustomer({ Name: "", Phone: "", LoyaltyPoints: 0, IsActive: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsDialogOpen(true);
  };

  const openViewDialog = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      const data = await apiClient.delete(`/customers/${customerToDelete.CustomerId}`);
      if (data.success) {
        toast.success(data.message || "Customer deleted successfully");
        setIsDeleteDialogOpen(false);
        fetchCustomers(); // Reload list
      } else {
        toast.error(data.error || "Failed to delete customer");
      }
    } catch (error) {
      toast.error("Network error while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating CSV from server...");
    
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/customers/export", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss(toastId);
      setTimeout(() => {
        toast.success("Customers exported successfully!");
      }, 1000);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to export customers");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/customers/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok && data.data) {
        toast.success(`Imported: ${data.data.imported_count}, Skipped: ${data.data.skipped_count}`);
        if (data.data.errors?.length > 0) {
          console.warn("Import errors:", data.data.errors);
          toast.error(`There were ${data.data.errors.length} errors. Check console.`);
        }
        fetchCustomers(); // Reload
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="relative w-full sm:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search customers by name or phone..." 
            className="pl-9 h-10 w-full bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={openNewDialog} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
          
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleImportClick} disabled={isImporting}>
            <Download className="mr-2 h-4 w-4" /> {isImporting ? "Importing..." : "Import"}
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleExport} disabled={isExporting}>
            <Upload className="mr-2 h-4 w-4" /> {isExporting ? "Exporting..." : "Export"}
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchCustomers} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-10 text-center">#</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-28">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Customer Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Loyalty Points</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Loading customers...</TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No customers found.</TableCell>
                </TableRow>
              ) : (
                customers.map((customer, idx) => (
                  <TableRow key={customer.CustomerId} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedIds.has(customer.CustomerId)}
                        onCheckedChange={() => toggleSelect(customer.CustomerId)}
                      />
                    </TableCell>
                    <TableCell className="text-center text-[13px] text-muted-foreground font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">
                      CUST-{customer.CustomerId.toString().padStart(5, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {customer.Name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.Phone || "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        {customer.LoyaltyPoints} pts
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <button 
                        onClick={() => handleToggleStatus(customer.CustomerId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          customer.IsActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {customer.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button onClick={() => openViewDialog(customer)} className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(customer)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => openDeleteDialog(customer)} className="hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentCustomer.CustomerId ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Customer Name</label>
              <Input 
                value={currentCustomer.Name || ""}
                onChange={e => setCurrentCustomer({...currentCustomer, Name: e.target.value})}
                placeholder="e.g. John Doe"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Phone Number <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <Input 
                value={currentCustomer.Phone || ""}
                onChange={e => setCurrentCustomer({...currentCustomer, Phone: e.target.value})}
                placeholder="e.g. +1 234 567 890"
                className="h-11"
              />
            </div>
            
            {/* Loyalty points can usually be viewed/edited by admin */}
            {currentCustomer.CustomerId && (
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-foreground">Loyalty Points</label>
                 <Input 
                   type="number"
                   value={currentCustomer.LoyaltyPoints}
                   onChange={e => setCurrentCustomer({...currentCustomer, LoyaltyPoints: parseInt(e.target.value) || 0})}
                   className="h-11"
                 />
               </div>
            )}

            {/* Status Toggle — shown for both Add and Edit */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Status</label>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    currentCustomer.IsActive ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-sm font-semibold",
                    currentCustomer.IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  )}>
                    {currentCustomer.IsActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentCustomer.IsActive ? "Customer is visible and usable" : "Customer is hidden from use"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentCustomer.IsActive}
                  onClick={() => setCurrentCustomer({...currentCustomer, IsActive: !currentCustomer.IsActive})}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30",
                    currentCustomer.IsActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                    currentCustomer.IsActive ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Customer Code</p>
                <p className="font-mono text-sm font-semibold">
                  CUST-{currentCustomer.CustomerId?.toString().padStart(5, '0')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center">
                  <span className={cn(
                    "px-3 py-1 text-[13px] font-bold rounded-full",
                    currentCustomer.IsActive 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  )}>
                    {currentCustomer.IsActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
              <p className="text-base font-medium">{currentCustomer.Name}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                <p className="text-sm">{currentCustomer.Phone || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Loyalty Points</p>
                <p className="text-sm font-semibold text-primary">{currentCustomer.LoyaltyPoints}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-rose-500/20">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-foreground/80">
            <p>Are you absolutely sure you want to delete the customer <strong>{customerToDelete?.Name}</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">This action is irreversible. It will be permanently removed from the database.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white">
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
