"use client";

import { useState, useEffect } from "react";
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
  const [isImporting, setIsImporting] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMedicine, setCurrentMedicine] = useState<Partial<Medicine>>({
    BrandName: "", GenericName: "", CategoryId: 0, CompanyId: 0, RackNumber: "",
    ReorderLevel: 10, RequiresPrescription: false, Unit: "Box", Barcode: "",
    DefaultCostPrice: 0, DefaultSellingPrice: 0, IsActive: true
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Medicines
      const url = new URL("http://localhost:8000/api/v1/medicines");
      if (search) url.searchParams.append("search", search);
      if (filterCategory) url.searchParams.append("category_id", filterCategory.toString());
      if (filterCompany) url.searchParams.append("company_id", filterCompany.toString());
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setMedicines(data.data);
      }
      
      // Fetch dropdown data only once if not loaded
      if (categories.length === 0) {
        const catRes = await fetch("http://localhost:8000/api/v1/categories");
        const catData = await catRes.json();
        if (catData.success) setCategories(catData.data.filter((c: any) => c.IsActive));
        
        const compRes = await fetch("http://localhost:8000/api/v1/companies");
        const compData = await compRes.json();
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
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterCategory, filterCompany]);

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/medicines/${id}/status`, { method: "PUT" });
      const data = await res.json();
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
        ? `http://localhost:8000/api/v1/medicines/${currentMedicine.MedicineId}`
        : `http://localhost:8000/api/v1/medicines`;
      
      const method = isEditing ? "PUT" : "POST";
      
      const payload = {
        ...currentMedicine,
        DefaultCostPrice: Number(currentMedicine.DefaultCostPrice),
        DefaultSellingPrice: Number(currentMedicine.DefaultSellingPrice),
        ReorderLevel: Number(currentMedicine.ReorderLevel)
      };
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || data.detail?.[0]?.msg || "Failed to save medicine");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const generateBarcode = () => {
    const barcode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setCurrentMedicine(prev => ({ ...prev, Barcode: barcode }));
  };

  const handleExport = () => {
    window.open("http://localhost:8000/api/v1/medicines/export", "_blank");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsImporting(true);
    toast.info("Importing medicines...");
    try {
      const res = await fetch("http://localhost:8000/api/v1/medicines/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok || data.success) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.detail || data.error || "Failed to import");
      }
    } catch (error) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      // reset file input
      e.target.value = '';
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
          <div className="relative">
            <Input 
              type="file" 
              accept=".csv" 
              onChange={handleImport} 
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              disabled={isImporting}
            />
            <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex w-full pointer-events-none" disabled={isImporting}>
              <Upload className="mr-2 h-4 w-4" /> {isImporting ? "Importing..." : "Import CSV"}
            </Button>
          </div>
          <Button variant="outline" onClick={handleExport} className="h-10 bg-background text-foreground hidden sm:flex">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center"><Checkbox /></TableHead>
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
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">Loading medicines...</TableCell>
                </TableRow>
              ) : medicines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No medicines found.</TableCell>
                </TableRow>
              ) : (
                medicines.map((med) => (
                  <TableRow key={med.MedicineId} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="text-center"><Checkbox /></TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">
                      MED-{med.MedicineId.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {med.BrandName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {med.GenericName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {med.CategoryName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {med.CompanyName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {med.Unit}
                    </TableCell>
                    <TableCell className="text-center">
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
                        <button className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(med)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
                        <button className="hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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

            {!currentMedicine.MedicineId && (
              <div className="space-y-2 md:col-span-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isActive" 
                    checked={currentMedicine.IsActive} 
                    onCheckedChange={(c) => setCurrentMedicine({...currentMedicine, IsActive: c as boolean})}
                  />
                  <label htmlFor="isActive" className="text-sm font-medium leading-none">
                    Set as Active
                  </label>
                </div>
              </div>
            )}
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Medicine Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
