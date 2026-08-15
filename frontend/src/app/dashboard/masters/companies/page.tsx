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

interface Company {
  CompanyId: number;
  CompanyName: string;
  ContactPerson?: string;
  Phone?: string;
  Address?: string;
  IsActive: boolean;
  TotalProducts?: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Partial<Company>>({ CompanyName: "", ContactPerson: "", Phone: "", Address: "", IsActive: true });
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allSelected = companies.length > 0 && selectedIds.size === companies.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < companies.length;
  const toggleSelectAll = () => {
    if (allSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(companies.map(c => c.CompanyId))); }
  };
  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (search) params.search = search;
      if (filterStatus !== "all") params.status = filterStatus;

      const data = await apiClient.get("/companies", { params });
      if (data.success) {
        setCompanies(data.data);
        setTotalRecords(data.total || 0);
        setSelectedIds(new Set());
      } else {
        toast.error("Failed to load companies");
      }
    } catch (error) {
      toast.error("Network error while loading companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchCompanies();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterStatus, page, pageSize]);

  const handleToggleStatus = async (id: number) => {
    try {
      const data = await apiClient.put(`/companies/${id}/status`);
      if (data.success) {
        toast.success(data.message);
        setCompanies(companies.map(c => c.CompanyId === id ? { ...c, IsActive: !c.IsActive } : c));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentCompany.CompanyName?.trim()) {
      toast.error("Company name is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const isEditing = !!currentCompany.CompanyId;
      const url = isEditing 
        ? `/companies/${currentCompany.CompanyId}`
        : `/companies`;
      
      const data = isEditing 
        ? await apiClient.put(url, currentCompany)
        : await apiClient.post(url, currentCompany);
      
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchCompanies(); // Reload list
      } else {
        toast.error(data.error || "Failed to save company");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const openNewDialog = () => {
    setCurrentCompany({ CompanyName: "", ContactPerson: "", Phone: "", Address: "", IsActive: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (company: Company) => {
    setCurrentCompany(company);
    setIsDialogOpen(true);
  };

  const openViewDialog = (company: Company) => {
    setCurrentCompany(company);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    setIsDeleting(true);
    try {
      const data = await apiClient.delete(`/companies/${companyToDelete.CompanyId}`);
      if (data.success) {
        toast.success(data.message || "Company deleted successfully");
        setIsDeleteDialogOpen(false);
        fetchCompanies(); // Reload list
      } else {
        toast.error(data.error || "Failed to delete company");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/companies/export", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "companies_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss(toastId);
      setTimeout(() => {
        toast.success("Companies exported successfully!");
      }, 1000);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to export companies");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/companies/import", {
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
        fetchCompanies(); // Reload
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
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search companies by name or phone..." 
              className="pl-9 h-10 w-full bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
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
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchCompanies} disabled={loading}>
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
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-1/4">Company Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-1/4">Contact Person</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32">Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Address / City</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-36 text-center">Total Products</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">Loading companies...</TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">No companies found.</TableCell>
                </TableRow>
              ) : (
                companies.map((company, idx) => (
                  <TableRow key={company.CompanyId} className="hover:bg-secondary/50 transition-colors h-14">
                    <TableCell className="text-center py-3">
                      <Checkbox
                        checked={selectedIds.has(company.CompanyId)}
                        onCheckedChange={() => toggleSelect(company.CompanyId)}
                      />
                    </TableCell>
                    <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 font-medium text-[14px]">{idx + 1}</TableCell>
                    <TableCell className="py-3 font-mono text-[14px] font-semibold text-[#111827] dark:text-gray-200">
                      COMP-{company.CompanyId.toString().padStart(5, '0')}
                    </TableCell>
                    <TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px]">
                      {company.CompanyName}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] max-w-[200px] truncate">
                      {company.ContactPerson || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px]">
                      {company.Phone || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] max-w-[200px] truncate">
                      {company.Address || "—"}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium">
                      {company.TotalProducts || 0}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <button 
                        onClick={() => handleToggleStatus(company.CompanyId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          company.IsActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {company.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button onClick={() => openViewDialog(company)} className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(company)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => openDeleteDialog(company)} className="hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Bottom Pagination */}
        {!loading && totalRecords > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4">
              <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRecords)} of {totalRecords}
              </span>
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-2" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-2" 
                  disabled={page * pageSize >= totalRecords}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentCompany.CompanyId ? "Edit Company" : "Add New Company"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Company Name <span className="text-rose-500">*</span></label>
              <Input 
                value={currentCompany.CompanyName || ""}
                onChange={e => setCurrentCompany({...currentCompany, CompanyName: e.target.value})}
                placeholder="e.g. Getz Pharma"
                className="h-11"
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Contact Person</label>
              <Input 
                value={currentCompany.ContactPerson || ""}
                onChange={e => setCurrentCompany({...currentCompany, ContactPerson: e.target.value})}
                placeholder="e.g. John Doe (Medical Rep)"
                className="h-11"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Phone Number</label>
              <Input 
                value={currentCompany.Phone || ""}
                onChange={e => setCurrentCompany({...currentCompany, Phone: e.target.value})}
                placeholder="e.g. +92 300 1234567"
                className="h-11"
              />
            </div>

            {/* Address / City */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Address / City</label>
              <textarea 
                value={currentCompany.Address || ""}
                onChange={e => setCurrentCompany({...currentCompany, Address: e.target.value})}
                placeholder="Optional company address or city..."
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>

            {/* Status Toggle — shown for both Add and Edit */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Status</label>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    currentCompany.IsActive ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-sm font-semibold",
                    currentCompany.IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  )}>
                    {currentCompany.IsActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentCompany.IsActive ? "Company is visible and usable" : "Company is hidden from use"}
                  </span>
                </div>
                {/* Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentCompany.IsActive}
                  onClick={() => setCurrentCompany({...currentCompany, IsActive: !currentCompany.IsActive})}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30",
                    currentCompany.IsActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                      currentCompany.IsActive ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Company Code</p>
              <p className="font-mono text-lg font-semibold">
                COMP-{currentCompany.CompanyId?.toString().padStart(5, '0')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Company Name</p>
              <p className="text-lg font-medium">{currentCompany.CompanyName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="flex items-center">
                <span className={cn(
                  "px-3 py-1 text-[13px] font-bold rounded-full",
                  currentCompany.IsActive 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                )}>
                  {currentCompany.IsActive ? "Active" : "Inactive"}
                </span>
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
            <p>Are you absolutely sure you want to delete the company <strong>{companyToDelete?.CompanyName}</strong>?</p>
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
