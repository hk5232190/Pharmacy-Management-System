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

interface Medicine {
  MedicineId: number;
  BrandName: string;
  GenericName: string;
  CategoryId: number;
  CompanyId: number;
  RackNumber?: string;
  ReorderLevel: number;
  RequiresPrescription: boolean;
  Unit: string;
  DosageForm?: string;
  Strength?: string;
  Barcode?: string;
  DefaultCostPrice: number;
  DefaultSellingPrice: number;
  IsActive: boolean;
  CategoryName?: string;
  CompanyName?: string;
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<{CategoryId: number, CategoryName: string}[]>([]);
  const [companies, setCompanies] = useState<{CompanyId: number, CompanyName: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterCompany, setFilterCompany] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<Medicine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allSelected = medicines.length > 0 && selectedIds.size === medicines.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < medicines.length;
  const toggleSelectAll = () => {
    if (allSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(medicines.map(m => m.MedicineId))); }
  };
  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  // Import/Export State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentMedicine, setCurrentMedicine] = useState<Partial<Medicine>>({
    BrandName: "", GenericName: "", CategoryId: 0, CompanyId: 0, RackNumber: "",
    ReorderLevel: 10, RequiresPrescription: false, Unit: "Box", DosageForm: "", Strength: "", Barcode: "",
    DefaultCostPrice: 0, DefaultSellingPrice: 0, IsActive: true
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (search) params.search = search;
      if (filterCategory) params.category_id = filterCategory.toString();
      if (filterCompany) params.company_id = filterCompany.toString();
      
      const data = await apiClient.get("/medicines", { params });
      if (data.success) {
        setMedicines(data.data);
        setTotalRecords(data.total || 0);
        setSelectedIds(new Set());
      }
      
      if (categories.length === 0) {
        const catData = await apiClient.get("/categories");
        if (catData.success) setCategories(catData.data.filter((c: any) => c.IsActive));
        
        const compData = await apiClient.get("/companies");
        if (compData.success) setCompanies(compData.data.filter((c: any) => c.IsActive));
      }
    } catch (error) {
      toast.error("Network error while loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMedicines();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterCategory, filterCompany, page, pageSize]);

  useEffect(() => {
    const handleMastersRefresh = () => fetchMedicines();
    window.addEventListener("refresh-masters-tab", handleMastersRefresh);
    return () => window.removeEventListener("refresh-masters-tab", handleMastersRefresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterCategory, filterCompany, page, pageSize]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterCategory, filterCompany]);

  // Removed Keyboard shortcut for Add New per user request

  const handleToggleStatus = async (id: number) => {
    try {
      const data = await apiClient.put(`/medicines/${id}/status`);
      if (data.success) {
        toast.success(data.message);
        setMedicines(medicines.map(m => m.MedicineId === id ? { ...m, IsActive: !m.IsActive } : m));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentMedicine.BrandName?.trim() || !currentMedicine.GenericName?.trim()) {
      toast.error("Brand Name and Generic Name are required");
      return;
    }
    if (!currentMedicine.CategoryId || !currentMedicine.CompanyId) {
      toast.error("Please select a Category and Company");
      return;
    }
    
    setIsSaving(true);
    try {
      const isEditing = !!currentMedicine.MedicineId;
      const url = isEditing 
        ? `/medicines/${currentMedicine.MedicineId}`
        : `/medicines`;
      
      const payload = {
        ...currentMedicine,
        DefaultCostPrice: Number(currentMedicine.DefaultCostPrice),
        DefaultSellingPrice: Number(currentMedicine.DefaultSellingPrice),
        ReorderLevel: Number(currentMedicine.ReorderLevel)
      };
      
      const data = isEditing 
        ? await apiClient.put(url, payload)
        : await apiClient.post(url, payload);
      
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchMedicines();
      } else {
        toast.error(data.error || "Failed to save medicine");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!medicineToDelete) return;
    setIsDeleting(true);
    try {
      const data = await apiClient.delete(`/medicines/${medicineToDelete.MedicineId}`);
      if (data.success) {
        toast.success(data.message || "Medicine deleted successfully");
        setIsDeleteDialogOpen(false);
        fetchMedicines();
      } else {
        toast.error(data.error || "Failed to delete medicine");
      }
    } catch (error) {
      toast.error("Network error while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const generateBarcode = () => {
    const barcode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setCurrentMedicine(prev => ({ ...prev, Barcode: barcode }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating CSV from server...");
    
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/medicines/export", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "medicines_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss(toastId);
      setTimeout(() => {
        toast.success("Medicines exported successfully!");
      }, 1000);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to export medicines");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/medicines/import", {
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
        fetchMedicines();
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openNewDialog = () => {
    setCurrentMedicine({
      BrandName: "", GenericName: "", CategoryId: 0, CompanyId: 0, RackNumber: "",
      ReorderLevel: 10, RequiresPrescription: false, Unit: "Box", Barcode: "",
      DefaultCostPrice: 0, DefaultSellingPrice: 0, IsActive: true
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (medicine: Medicine) => {
    setCurrentMedicine(medicine);
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search medicines..." 
              className="pl-9 h-10 w-full bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
            ))}
          </select>
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All Companies</option>
            {companies.map(c => (
              <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={openNewDialog} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
          
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleImportClick} disabled={isImporting}>
            <Download className="mr-2 h-4 w-4" /> {isImporting ? "Importing..." : "Import CSV"}
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleExport} disabled={isExporting}>
            <Upload className="mr-2 h-4 w-4" /> {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchMedicines} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? (true as any) : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-10 text-center">#</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-24">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Medicine Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Generic Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Category</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Company</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-20">Unit</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-28 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">Loading medicines...</TableCell>
                </TableRow>
              ) : medicines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">No medicines found.</TableCell>
                </TableRow>
              ) : (
                medicines.map((med, idx) => (
                  <TableRow key={med.MedicineId} className="hover:bg-secondary/50 transition-colors h-14">
                    <TableCell className="text-center py-3">
                      <Checkbox
                        checked={selectedIds.has(med.MedicineId)}
                        onCheckedChange={() => toggleSelect(med.MedicineId)}
                      />
                    </TableCell>
                    <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 font-medium text-[14px]">{idx + 1}</TableCell>
                    <TableCell className="py-3 font-mono text-[14px] font-semibold text-[#111827] dark:text-gray-200">
                      MED-{med.MedicineId.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px]">
                      {med.BrandName}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium">
                      {med.GenericName}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium">
                      {med.CategoryName || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium">
                      {med.CompanyName || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium">
                      {med.Unit}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <button 
                        onClick={() => handleToggleStatus(med.MedicineId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          med.IsActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {med.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button onClick={() => { setCurrentMedicine(med); setIsViewDialogOpen(true); }} className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(med)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => { setMedicineToDelete(med); setIsDeleteDialogOpen(true); }} className="hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentMedicine.MedicineId ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            
            <div className="space-y-2 md:col-span-2 text-primary font-semibold border-b pb-1">
              Basic Information
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Brand Name *</label>
              <Input 
                value={currentMedicine.BrandName || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, BrandName: e.target.value})}
                placeholder="e.g. Panadol"
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Generic Name *</label>
              <Input 
                value={currentMedicine.GenericName || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, GenericName: e.target.value})}
                placeholder="e.g. Paracetamol"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category *</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={currentMedicine.CategoryId || 0}
                onChange={e => setCurrentMedicine({...currentMedicine, CategoryId: Number(e.target.value)})}
              >
                <option value={0} disabled>Select Category</option>
                {categories.map(c => (
                  <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Company *</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={currentMedicine.CompanyId || 0}
                onChange={e => setCurrentMedicine({...currentMedicine, CompanyId: Number(e.target.value)})}
              >
                <option value={0} disabled>Select Company</option>
                {companies.map(c => (
                  <option key={c.CompanyId} value={c.CompanyId}>{c.CompanyName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Unit</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={currentMedicine.Unit || "Box"}
                onChange={e => setCurrentMedicine({...currentMedicine, Unit: e.target.value})}
              >
                <option value="Box">Box</option>
                <option value="Strip">Strip</option>
                <option value="Bottle">Bottle</option>
                <option value="Tube">Tube</option>
                <option value="Injection">Injection</option>
                <option value="Pieces">Pieces</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Dosage Form</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={currentMedicine.DosageForm || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, DosageForm: e.target.value})}
              >
                <option value="">Select Type</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Cream">Cream</option>
                <option value="Drops">Drops</option>
                <option value="Ointment">Ointment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Strength</label>
              <Input 
                value={currentMedicine.Strength || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, Strength: e.target.value})}
                placeholder="e.g. 500mg, 10ml"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Barcode</label>
              <div className="flex gap-2">
                <Input 
                  value={currentMedicine.Barcode || ""}
                  onChange={e => setCurrentMedicine({...currentMedicine, Barcode: e.target.value})}
                  placeholder="Scan or type barcode"
                  className="h-10 font-mono"
                />
                <Button type="button" variant="outline" onClick={generateBarcode} className="h-10 px-3 whitespace-nowrap text-xs">
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2 text-primary font-semibold border-b pb-1 mt-2">
              Pricing & Inventory Metadata
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Default Cost Price</label>
              <Input 
                type="number"
                min="0"
                step="0.01"
                value={currentMedicine.DefaultCostPrice}
                onChange={e => setCurrentMedicine({...currentMedicine, DefaultCostPrice: Number(e.target.value)})}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Default Selling Price</label>
              <Input 
                type="number"
                min="0"
                step="0.01"
                value={currentMedicine.DefaultSellingPrice}
                onChange={e => setCurrentMedicine({...currentMedicine, DefaultSellingPrice: Number(e.target.value)})}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Reorder Level (Min Stock)</label>
              <Input 
                type="number"
                min="0"
                value={currentMedicine.ReorderLevel}
                onChange={e => setCurrentMedicine({...currentMedicine, ReorderLevel: Number(e.target.value)})}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Rack Number</label>
              <Input 
                value={currentMedicine.RackNumber || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, RackNumber: e.target.value})}
                placeholder="e.g. A-12"
                className="h-10"
              />
            </div>

            <div className="space-y-2 md:col-span-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="prescription" 
                  checked={currentMedicine.RequiresPrescription} 
                  onCheckedChange={(c) => setCurrentMedicine({...currentMedicine, RequiresPrescription: c as boolean})}
                />
                <label htmlFor="prescription" className="text-sm font-medium leading-none">
                  Requires Prescription?
                </label>
              </div>
            </div>

            {/* Status Toggle — shown for both Add and Edit */}
            <div className="space-y-2 md:col-span-2 mt-2">
              <label className="text-sm font-semibold text-foreground">Status</label>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    currentMedicine.IsActive ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-sm font-semibold",
                    currentMedicine.IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  )}>
                    {currentMedicine.IsActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentMedicine.IsActive ? "Medicine is visible in catalog" : "Medicine is hidden from catalog"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentMedicine.IsActive}
                  onClick={() => setCurrentMedicine({...currentMedicine, IsActive: !currentMedicine.IsActive})}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30",
                    currentMedicine.IsActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                    currentMedicine.IsActive ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Medicine Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-rose-500/20">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-foreground/80">
            <p>Are you absolutely sure you want to delete <strong>{medicineToDelete?.BrandName}</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone. All related data will be permanently removed.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white">
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Medicine Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Medicine Code</p>
                <p className="font-mono text-sm font-semibold">
                  MED-{currentMedicine.MedicineId?.toString().padStart(5, '0')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center">
                  <span className={cn(
                    "px-3 py-1 text-[13px] font-bold rounded-full",
                    currentMedicine.IsActive 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  )}>
                    {currentMedicine.IsActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">Brand Name</p>
              <p className="text-base font-medium">{currentMedicine.BrandName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Generic Name</p>
              <p className="text-sm">{currentMedicine.GenericName}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Category</p>
                <p className="text-sm">{currentMedicine.CategoryName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Company</p>
                <p className="text-sm">{currentMedicine.CompanyName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Dosage Form</p>
                <p className="text-sm">{currentMedicine.DosageForm || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Strength</p>
                <p className="text-sm">{currentMedicine.Strength || "—"}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Cost Price</p>
                <p className="text-sm">Rs. {currentMedicine.DefaultCostPrice}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Selling Price</p>
                <p className="text-sm font-semibold text-primary">Rs. {currentMedicine.DefaultSellingPrice}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

