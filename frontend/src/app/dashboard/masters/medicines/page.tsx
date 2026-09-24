"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { Search, Plus, Download, Upload, Eye, Edit, Trash2, Package, PackagePlus, X, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportPreviewModal } from "@/components/medicines/import-preview-modal";
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
import { apiClient, API_BASE_URL } from "@/lib/api-client";
import { useInventorySettings } from "@/contexts/InventorySettingsContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface InitialStockBatch {
  id: string; // local key for React rendering
  BatchCode: string;
  Quantity: string;
  CostPrice: string;
  SellingPrice: string;
  ExpiryDate: string;
  ManufacturingDate: string;
}

function makeEmptyBatch(): InitialStockBatch {
  return {
    id: Math.random().toString(36).slice(2),
    BatchCode: "",
    Quantity: "",
    CostPrice: "",
    SellingPrice: "",
    ExpiryDate: "",
    ManufacturingDate: "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial Stock Section sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface InitialStockSectionProps {
  batches: InitialStockBatch[];
  onChange: (batches: InitialStockBatch[]) => void;
  isEditing: boolean;
}

function InitialStockSection({ batches, onChange, isEditing }: InitialStockSectionProps) {
  const updateBatch = (idx: number, field: keyof InitialStockBatch, value: string) => {
    const next = batches.map((b, i) => (i === idx ? { ...b, [field]: value } : b));
    onChange(next);
  };

  const addBatch = () => onChange([...batches, makeEmptyBatch()]);

  const removeBatch = (idx: number) => onChange(batches.filter((_, i) => i !== idx));

  return (
    <div className="md:col-span-2 space-y-4">
      {/* Section header — same border-t divider as Status row */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-semibold text-foreground">Initial Stock</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          Optional
        </span>
        {isEditing && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-2 py-0.5 rounded-full">
            Not available in Edit mode — use Stock Adjustments or Purchases to add stock
          </span>
        )}
      </div>

      {isEditing ? null : (
        <>
          {batches.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No initial stock added. Click below to add a batch.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-10 text-sm border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={addBatch}
              >
                <PackagePlus className="h-4 w-4 mr-2" />
                Add Batch
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {batches.map((batch, idx) => (
                <div key={batch.id}>
                  {/* Batch header row — same style as other labels */}
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-foreground">
                      Batch {idx + 1}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeBatch(idx)}
                      className="text-sm text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1"
                      title="Remove batch"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  </div>

                  {/* Fields — exact same grid and spacing as the rest of the form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Batch Number <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        className="h-10"
                        placeholder="e.g. BT-2025-001"
                        value={batch.BatchCode}
                        onChange={e => updateBatch(idx, "BatchCode", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Quantity <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        className="h-10"
                        type="number"
                        min="1"
                        placeholder="e.g. 100"
                        value={batch.Quantity}
                        onChange={e => updateBatch(idx, "Quantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Cost Price <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        className="h-10"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 50.00"
                        value={batch.CostPrice}
                        onChange={e => updateBatch(idx, "CostPrice", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Selling Price <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        className="h-10"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 75.00"
                        value={batch.SellingPrice}
                        onChange={e => updateBatch(idx, "SellingPrice", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Expiry Date <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        className="h-10"
                        type="date"
                        value={batch.ExpiryDate}
                        onChange={e => updateBatch(idx, "ExpiryDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Manufacturing Date{" "}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <Input
                        className="h-10"
                        type="date"
                        value={batch.ManufacturingDate}
                        onChange={e => updateBatch(idx, "ManufacturingDate", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Thin divider between batches */}
                  {idx < batches.length - 1 && (
                    <div className="border-t border-border mt-4" />
                  )}
                </div>
              ))}

              {/* Add Another Batch — same h-10 height as all other buttons */}
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full border-dashed border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={addBatch}
              >
                <PackagePlus className="h-4 w-4 mr-2" />
                + Add Another Batch
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate initial stock batches before save
// ─────────────────────────────────────────────────────────────────────────────

function validateInitialStock(batches: InitialStockBatch[]): string | null {
  if (batches.length === 0) return null;

  const codes = new Set<string>();
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    const num = i + 1;
    if (!b.BatchCode.trim()) return `Batch ${num}: Batch Number is required`;
    const code = b.BatchCode.trim().toUpperCase();
    if (codes.has(code)) return `Batch ${num}: Duplicate Batch Number '${code}'`;
    codes.add(code);
    if (!b.Quantity || parseInt(b.Quantity) <= 0) return `Batch ${num}: Quantity must be > 0`;
    if (!b.CostPrice || parseFloat(b.CostPrice) < 0) return `Batch ${num}: Cost Price is required`;
    if (!b.SellingPrice || parseFloat(b.SellingPrice) < 0) return `Batch ${num}: Selling Price is required`;
    if (!b.ExpiryDate) return `Batch ${num}: Expiry Date is required`;
    if (b.ManufacturingDate && b.ManufacturingDate > b.ExpiryDate) {
      return `Batch ${num}: Manufacturing Date must be on or before Expiry Date`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicinesPage() {
  const { inventorySettings } = useInventorySettings();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterCompany, setFilterCompany] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const swrKey = useMemo(() => {
    const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() });
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (filterCategory) params.append("category_id", filterCategory.toString());
    if (filterCompany) params.append("company_id", filterCompany.toString());
    return `/medicines?${params.toString()}`;
  }, [page, pageSize, debouncedSearch, filterCategory, filterCompany]);

  const { data: medData, mutate: mutateMedicines, isLoading } = useSWR(swrKey, async (url: string) => {
    const res = await apiClient.get<any>(url);
    if (res.success === false) throw new Error(res.error);
    return res;
  });

  const { data: catData, mutate: mutateCategories } = useSWR("/categories", async (url: string) => {
    const res = await apiClient.get<any>(url);
    if (res.success === false) throw new Error(res.error);
    return res.data.filter((c: any) => c.IsActive);
  });

  const { data: compData, mutate: mutateCompanies } = useSWR("/companies", async (url: string) => {
    const res = await apiClient.get<any>(url);
    if (res.success === false) throw new Error(res.error);
    return res.data.filter((c: any) => c.IsActive);
  });

  const medicines: Medicine[] = medData?.data || [];
  const totalRecords = medData?.total || 0;
  const categories: {CategoryId: number, CategoryName: string}[] = catData || [];
  const companies: {CompanyId: number, CompanyName: string}[] = compData || [];
  const loading = isLoading;
  
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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
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
  const brandNameInputRef = useRef<HTMLInputElement>(null);

  // Initial Stock state (only used in Add mode)
  const [initialStockBatches, setInitialStockBatches] = useState<InitialStockBatch[]>([]);

  const handleCreateCategory = async (name: string) => {
    try {
      const res = await apiClient.post("/categories", { CategoryName: name, IsActive: true });
      if (res.success && res.data) {
        mutateCategories();
        setCurrentMedicine(prev => ({ ...prev, CategoryId: res.data.CategoryId }));
        toast.success(`Category "${name}" added`);
      } else {
        toast.error(res.error || "Failed to create category");
      }
    } catch (error) {
      toast.error("Error creating category");
    }
  };

  const handleCreateCompany = async (name: string) => {
    try {
      const res = await apiClient.post("/companies", { CompanyName: name, IsActive: true });
      if (res.success && res.data) {
        mutateCompanies();
        setCurrentMedicine(prev => ({ ...prev, CompanyId: res.data.CompanyId }));
        toast.success(`Company "${name}" added`);
      } else {
        toast.error(res.error || "Failed to create company");
      }
    } catch (error) {
      toast.error("Error creating company");
    }
  };


  useEffect(() => {
    const handleMastersRefresh = () => mutateMedicines();
    window.addEventListener("refresh-masters-tab", handleMastersRefresh);
    return () => window.removeEventListener("refresh-masters-tab", handleMastersRefresh);
  }, [mutateMedicines]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, filterCompany]);

  // Removed Keyboard shortcut for Add New per user request

  const handleToggleStatus = async (id: number) => {
    try {
      const data = await apiClient.put(`/medicines/${id}/status`);
      if (data.success) {
        toast.success(data.message);
        mutateMedicines(
          medData ? { ...medData, data: medData.data.map((m: Medicine) => m.MedicineId === id ? { ...m, IsActive: !m.IsActive } : m) } : undefined,
          { revalidate: false }
        );
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentMedicine.BrandName?.trim() || !currentMedicine.GenericName?.trim()) {
      toast.error("Brand Name and Formula are required");
      return;
    }
    if (!currentMedicine.CategoryId || !currentMedicine.CompanyId) {
      toast.error("Please select a Category and Company");
      return;
    }

    const isEditing = !!currentMedicine.MedicineId;

    // Validate initial stock batches (only for new medicines)
    if (!isEditing && initialStockBatches.length > 0) {
      const stockError = validateInitialStock(initialStockBatches);
      if (stockError) {
        toast.error(stockError);
        return;
      }
    }
    
    setIsSaving(true);
    try {
      const url = isEditing 
        ? `/medicines/${currentMedicine.MedicineId}`
        : `/medicines`;
      
      const medicinePayload = {
        ...currentMedicine,
        DefaultCostPrice: Number(currentMedicine.DefaultCostPrice || 0),
        DefaultSellingPrice: Number(currentMedicine.DefaultSellingPrice || 0),
        ReorderLevel: Number(currentMedicine.ReorderLevel || 10),
      };

      // For new medicines, attach initial_stock if provided
      let payload: any = medicinePayload;
      if (!isEditing && initialStockBatches.length > 0) {
        payload = {
          ...medicinePayload,
          initial_stock: initialStockBatches.map(b => ({
            BatchCode: b.BatchCode.trim().toUpperCase(),
            Quantity: parseInt(b.Quantity),
            CostPrice: parseFloat(b.CostPrice),
            SellingPrice: parseFloat(b.SellingPrice),
            ExpiryDate: b.ExpiryDate,
            ManufacturingDate: b.ManufacturingDate || null,
          })),
        };
      }
      
      const data = isEditing 
        ? await apiClient.put(url, payload)
        : await apiClient.post(url, payload);
      
      if (data.success) {
        toast.success(data.message);
        if (!isEditing) {
          setCurrentMedicine({
            BrandName: "", GenericName: "", CategoryId: 0, CompanyId: 0, RackNumber: "",
            ReorderLevel: 10, 
            RequiresPrescription: false, 
            Unit: "Box", 
            DosageForm: "", Strength: "", Barcode: "",
            DefaultCostPrice: 0, DefaultSellingPrice: 0, IsActive: true
          });
          setInitialStockBatches([]);
          setTimeout(() => brandNameInputRef.current?.focus(), 100);
        } else {
          setIsDialogOpen(false);
        }
        mutateMedicines();
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
        mutateMedicines();
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
      const res = await fetch(`${API_BASE_URL}/medicines/export`, {
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

  
  const handleConfirmImport = async (validData: any[]) => {
    setIsImporting(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

      // Transform grouped preview entries into MedicineCreate payloads.
      // Each entry may have multiple batches (InitialBatches) and optionally an ExistingMedicineId.
      const payload = validData.map((row: any) => {
        const med: any = {
          BrandName:            row.BrandName,
          GenericName:          row.GenericName,
          CategoryId:           row.CategoryId,
          CompanyId:            row.CompanyId,
          Unit:                 row.Unit || "Box",
          DosageForm:           row.DosageForm || null,
          ReorderLevel:         row.ReorderLevel || 10,
          RackNumber:           row.RackNumber || null,
          RequiresPrescription: row.RequiresPrescription || false,
          IsActive:             row.IsActive !== false,
          DefaultCostPrice:     row.DefaultCostPrice || 0,
          DefaultSellingPrice:  row.DefaultSellingPrice || 0,
          Barcode:              row.Barcode || null,
          ExistingMedicineId:   row.ExistingMedicineId || null,
        };
        // InitialBatches is now an array (may be empty)
        if (row.InitialBatches && row.InitialBatches.length > 0) {
          med.initial_stock = row.InitialBatches;
        }
        return med;
      });

      const res = await fetch(`${API_BASE_URL}/medicines/import-bulk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Import successful");
        setIsPreviewModalOpen(false);
        mutateMedicines();
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportWithStock = async () => {
    const toastId = toast.loading("Building medicines + stock export...");
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/medicines/export-with-stock`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "medicines_with_stock_export.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.dismiss(toastId);
      setTimeout(() => toast.success("Export with stock downloaded!"), 800);
    } catch {
      toast.dismiss(toastId);
      toast.error("Failed to export medicines with stock");
    }
  };

  const handleDownloadTemplate = async () => {
    const toastId = toast.loading("Generating smart template...");
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/medicines/import-template`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Template download failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "medicines_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss(toastId);
      toast.success("Template downloaded successfully");
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to download template");
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
      const res = await fetch(`${API_BASE_URL}/medicines/import-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewData(data.data);
        setIsPreviewModalOpen(true);
      } else {
        toast.error(data.detail || data.message || "Failed to parse file");
      }
    } catch (err) {
      toast.error("Network error during file processing");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openNewDialog = () => {
    setCurrentMedicine({
      BrandName: "", GenericName: "", CategoryId: 0, CompanyId: 0, RackNumber: "",
      ReorderLevel: inventorySettings.LowStockThreshold || 10, 
      RequiresPrescription: false, 
      Unit: inventorySettings.DefaultUnit || "Box", 
      Barcode: "",
      DefaultCostPrice: 0, 
      DefaultSellingPrice: 0, 
      IsActive: true
    });
    setInitialStockBatches([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (medicine: Medicine) => {
    setCurrentMedicine(medicine);
    setInitialStockBatches([]); // Not editable in edit mode
    setIsDialogOpen(true);
  };

  const unitOptions = [
    { value: "Box", label: "Box" },
    { value: "Strip", label: "Strip" },
    { value: "Bottle", label: "Bottle" },
    { value: "Tube", label: "Tube" },
    { value: "Piece", label: "Piece" },
    { value: "Vial", label: "Vial" },
    { value: "Ampoule", label: "Ampoule" },
    { value: "Sachet", label: "Sachet" },
    { value: "Pack", label: "Pack" },
    { value: "Jar", label: "Jar" },
    { value: "Can", label: "Can" },
  ];
  if (currentMedicine?.Unit && !unitOptions.find(o => o.value === currentMedicine.Unit)) {
    unitOptions.push({ value: currentMedicine.Unit, label: `${currentMedicine.Unit} (Legacy)` });
  }

  const dosageOptions = [
    { value: "Tablet", label: "Tablet" },
    { value: "Capsule", label: "Capsule" },
    { value: "Syrup", label: "Syrup" },
    { value: "Suspension", label: "Suspension" },
    { value: "Injection", label: "Injection" },
    { value: "Cream", label: "Cream" },
    { value: "Ointment", label: "Ointment" },
    { value: "Drops", label: "Drops" },
    { value: "Gel", label: "Gel" },
    { value: "Lotion", label: "Lotion" },
    { value: "Spray", label: "Spray" },
    { value: "Inhaler", label: "Inhaler" },
    { value: "Powder", label: "Powder" },
    { value: "Suppository", label: "Suppository" },
    { value: "Other", label: "Other" },
  ];
  if (currentMedicine?.DosageForm && !dosageOptions.find(o => o.value === currentMedicine.DosageForm)) {
    dosageOptions.push({ value: currentMedicine.DosageForm, label: `${currentMedicine.DosageForm} (Legacy)` });
  }

  const isEditing = !!currentMedicine.MedicineId;

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
          <Select 
            value={filterCategory === "" ? "none" : filterCategory.toString()}
            onValueChange={(val) => setFilterCategory(val === "none" ? "" : Number(val))}
          >
            <SelectTrigger className="h-10 w-full sm:w-[180px] bg-background">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.CategoryId} value={c.CategoryId.toString()}>{c.CategoryName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={filterCompany === "" ? "none" : filterCompany.toString()}
            onValueChange={(val) => setFilterCompany(val === "none" ? "" : Number(val))}
          >
            <SelectTrigger className="h-10 w-full sm:w-[180px] bg-background">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Companies</SelectItem>
              {companies.map(c => (
                <SelectItem key={c.CompanyId} value={c.CompanyId.toString()}>{c.CompanyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={openNewDialog} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
          
          <input type="file" accept=".csv, .xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Template
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleImportClick} disabled={isImporting}>
            <Upload className="mr-2 h-4 w-4" /> {isImporting ? "Importing..." : "Import CSV"}
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleExport} disabled={isExporting}>
            <Upload className="mr-2 h-4 w-4" /> {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="outline" className="h-10 bg-background text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hidden sm:flex" onClick={handleExportWithStock}>
            <FileDown className="mr-2 h-4 w-4" /> Export with Stock
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-secondary/50 text-left">
              <TableRow className="hover:bg-transparent">

                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-10 text-center">#</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-24 text-center">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left">Medicine Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left max-w-[200px]">Formula</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left">Category</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left">Company</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-20 text-left">Unit</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left">Dosage Form</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-28 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center pr-6 w-32">Actions</TableHead>
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

                    <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 font-medium text-[14px]">{idx + 1}</TableCell>
                    <TableCell className="py-3 font-mono text-[14px] font-semibold text-[#111827] dark:text-gray-200 text-left">
                      MED-{med.MedicineId.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px] text-left">
                      {med.BrandName}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium text-left max-w-[200px] truncate" title={med.GenericName}>
                      {med.GenericName}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium text-left">
                      {med.CategoryName || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium text-left">
                      {med.CompanyName || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium text-left">
                      {med.Unit}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium text-left">
                      {med.DosageForm || "—"}
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
                    <TableCell className="text-center pr-6">
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
              <Select 
                value={pageSize.toString()}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[70px] bg-background">
                  <SelectValue placeholder="25" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
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

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Brand Name *</label>
              <Input 
                id="brand-name-input"
                ref={brandNameInputRef}
                value={currentMedicine.BrandName || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, BrandName: e.target.value})}
                placeholder="e.g. Panadol"
                className="h-10"
                onKeyDown={e => {
                  if(e.key === 'Enter') { e.preventDefault(); document.getElementById('formula-input')?.focus(); }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Formula *</label>
              <Input 
                id="formula-input"
                value={currentMedicine.GenericName || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, GenericName: e.target.value})}
                placeholder="e.g. Paracetamol"
                className="h-10"
                onKeyDown={e => {
                  if(e.key === 'Enter') { e.preventDefault(); document.getElementById('category-input')?.focus(); }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category *</label>
              <SmartCombobox
                id="category-input"
                options={categories.map(c => ({ value: c.CategoryId, label: c.CategoryName }))}
                value={currentMedicine.CategoryId}
                onChange={val => setCurrentMedicine({...currentMedicine, CategoryId: Number(val)})}
                onCreateNew={handleCreateCategory}
                placeholder="Type to search or add..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Company *</label>
              <SmartCombobox
                options={companies.map(c => ({ value: c.CompanyId, label: c.CompanyName }))}
                value={currentMedicine.CompanyId}
                onChange={val => setCurrentMedicine({...currentMedicine, CompanyId: Number(val)})}
                onCreateNew={handleCreateCompany}
                placeholder="Type to search or add..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Unit</label>
              <SmartCombobox
                options={unitOptions}
                value={currentMedicine.Unit || "Box"}
                onChange={val => setCurrentMedicine({...currentMedicine, Unit: String(val)})}
                placeholder="Search unit..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Dosage Form</label>
              <SmartCombobox
                options={dosageOptions}
                value={currentMedicine.DosageForm || ""}
                onChange={val => setCurrentMedicine({...currentMedicine, DosageForm: String(val)})}
                placeholder="Search type..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Reorder Level (Min Stock)</label>
              <Input 
                type="number" min="0"
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

            <div className="space-y-2 md:col-span-2 mt-1">
              <label className="text-sm font-semibold text-foreground">Status</label>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", currentMedicine.IsActive ? "bg-emerald-500" : "bg-rose-500")} />
                  <span className={cn("text-sm font-semibold", currentMedicine.IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                    {currentMedicine.IsActive ? "Active" : "Inactive"}
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

            {/* ── Initial Stock Section ──────────────────────────────────────── */}
            <InitialStockSection
              batches={initialStockBatches}
              onChange={setInitialStockBatches}
              isEditing={isEditing}
            />

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Close</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : (isEditing ? "Save Changes" : "Save & Add Another")}
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
              <p className="text-sm font-medium text-muted-foreground">Formula</p>
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
                <p className="text-sm font-medium text-muted-foreground">Unit</p>
                <p className="text-sm">{currentMedicine.Unit || "Box"}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Reorder Level</p>
                <p className="text-sm">{currentMedicine.ReorderLevel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Rack Number</p>
                <p className="text-sm">{currentMedicine.RackNumber || "—"}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        initialData={previewData}
        categories={categories}
        companies={companies}
        onConfirm={handleConfirmImport}
        isSaving={isImporting}
        setCategories={mutateCategories}
        setCompanies={mutateCompanies}
      />


    </div>
  );
}
