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

interface Supplier {
  SupplierId: number;
  Name: string;
  Phone: string;
  TaxNumber?: string;
  Address?: string;
  IsActive: boolean;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier>>({ Name: "", Phone: "", TaxNumber: "", Address: "", IsActive: true });
  const [isSaving, setIsSaving] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const url = new URL("http://localhost:8000/api/v1/suppliers");
      if (search) url.searchParams.append("search", search);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setSuppliers(data.data);
      } else {
        toast.error("Failed to load suppliers");
      }
    } catch (error) {
      toast.error("Network error while loading suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/suppliers/${id}/status`, { method: "PUT" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSuppliers(suppliers.map(s => s.SupplierId === id ? { ...s, IsActive: !s.IsActive } : s));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentSupplier.Name?.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (!currentSupplier.Phone?.trim()) {
      toast.error("Supplier phone is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const isEditing = !!currentSupplier.SupplierId;
      const url = isEditing 
        ? `http://localhost:8000/api/v1/suppliers/${currentSupplier.SupplierId}`
        : `http://localhost:8000/api/v1/suppliers`;
      
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSupplier)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchSuppliers(); // Reload list
      } else {
        toast.error(data.error || "Failed to save supplier");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const openNewDialog = () => {
    setCurrentSupplier({ Name: "", Phone: "", TaxNumber: "", Address: "", IsActive: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="relative w-full sm:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search suppliers by name, phone or tax..." 
            className="pl-9 h-10 w-full bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={openNewDialog} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex">
            <Download className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex">
            <Upload className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchSuppliers}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center"><Checkbox /></TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-28">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Supplier Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Tax Number</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading suppliers...</TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No suppliers found.</TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier.SupplierId} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="text-center"><Checkbox /></TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">
                      SUP-{supplier.SupplierId.toString().padStart(5, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {supplier.Name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.Phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.TaxNumber || "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      <button 
                        onClick={() => handleToggleStatus(supplier.SupplierId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          supplier.IsActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {supplier.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(supplier)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentSupplier.SupplierId ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Supplier Name</label>
              <Input 
                value={currentSupplier.Name || ""}
                onChange={e => setCurrentSupplier({...currentSupplier, Name: e.target.value})}
                placeholder="e.g. HealthCare Distributors"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Phone Number</label>
              <Input 
                value={currentSupplier.Phone || ""}
                onChange={e => setCurrentSupplier({...currentSupplier, Phone: e.target.value})}
                placeholder="e.g. +1 234 567 890"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Tax Number <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <Input 
                value={currentSupplier.TaxNumber || ""}
                onChange={e => setCurrentSupplier({...currentSupplier, TaxNumber: e.target.value})}
                placeholder="e.g. TX-9876543"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Address <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <Input 
                value={currentSupplier.Address || ""}
                onChange={e => setCurrentSupplier({...currentSupplier, Address: e.target.value})}
                placeholder="Full address"
                className="h-11"
              />
            </div>

            {!currentSupplier.SupplierId && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox 
                  id="isActive" 
                  checked={currentSupplier.IsActive} 
                  onCheckedChange={(c) => setCurrentSupplier({...currentSupplier, IsActive: c as boolean})}
                />
                <label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Set as Active
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
