"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Save, Package, RefreshCw } from "lucide-react";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types — preview entries are now GROUPED (one per medicine)
// ─────────────────────────────────────────────────────────────────────────────

interface BatchPreview {
  BatchCode: string;
  Quantity: number;
  CostPrice: number;
  SellingPrice: number;
  ExpiryDate: string;
  ManufacturingDate?: string | null;
}

interface MedicinePreviewEntry {
  RowNumbers: number[];         // which source rows contributed
  BrandName: string;
  GenericName: string;
  CategoryName: string;
  CompanyName: string;
  Unit: string;
  DosageForm: string;
  ReorderLevel: number;
  RackNumber: string;
  IsActive: boolean;
  DefaultCostPrice: number;
  DefaultSellingPrice: number;
  Barcode?: string | null;
  CategoryId: number | null;
  CompanyId: number | null;
  IsValid: boolean;
  Errors: string[];
  InitialBatches: BatchPreview[];   // aggregated from all source rows
  ExistingMedicineId: number | null; // null = create new, set = add batches to existing
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: MedicinePreviewEntry[];
  categories: { CategoryId: number; CategoryName: string }[];
  companies:  { CompanyId: number;  CompanyName: string }[];
  onConfirm: (validData: MedicinePreviewEntry[]) => void;
  isSaving: boolean;
  setCategories: (c: any) => void;
  setCompanies:  (c: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline re-validation (mirrors backend rules for quick UX feedback)
// ─────────────────────────────────────────────────────────────────────────────

function revalidate(entry: MedicinePreviewEntry): MedicinePreviewEntry {
  const errors: string[] = [];
  let valid = true;

  if (!entry.BrandName)   { valid = false; errors.push("Brand Name is required"); }
  if (!entry.GenericName) { valid = false; errors.push("Formula is required"); }
  if (!entry.CategoryId && !entry.ExistingMedicineId) { valid = false; errors.push("Category is required"); }
  if (!entry.CompanyId  && !entry.ExistingMedicineId) { valid = false; errors.push("Company is required"); }
  if (!entry.Unit)        { valid = false; errors.push("Unit is required"); }

  return { ...entry, IsValid: valid, Errors: errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch pill component
// ─────────────────────────────────────────────────────────────────────────────

function BatchList({ batches }: { batches: BatchPreview[] }) {
  if (!batches || batches.length === 0) {
    return <span className="text-xs text-muted-foreground/50">No stock</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {batches.map((b, i) => (
        <div
          key={i}
          className="text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 rounded-md px-2 py-1 space-y-0.5"
        >
          <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <Package className="w-3 h-3" />
            {b.BatchCode}
          </div>
          <div className="text-muted-foreground">
            Qty: <strong>{b.Quantity}</strong> · Cost: {b.CostPrice} · Sell: {b.SellingPrice}
          </div>
          <div className="text-muted-foreground">Exp: {b.ExpiryDate}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

export function ImportPreviewModal({
  isOpen,
  onClose,
  initialData,
  categories,
  companies,
  onConfirm,
  isSaving,
  setCategories,
  setCompanies,
}: ImportPreviewModalProps) {
  const [data, setData] = useState<MedicinePreviewEntry[]>([]);

  useEffect(() => { setData(initialData); }, [initialData]);

  const allValid     = data.length > 0 && data.every(e => e.IsValid);
  const errorCount   = data.filter(e => !e.IsValid).length;
  const withStock    = data.filter(e => e.InitialBatches?.length > 0).length;
  const willCreate   = data.filter(e => !e.ExistingMedicineId).length;
  const willUpdate   = data.filter(e =>  e.ExistingMedicineId).length;
  const totalBatches = data.reduce((n, e) => n + (e.InitialBatches?.length ?? 0), 0);

  const updateEntry = (index: number, updates: Partial<MedicinePreviewEntry>) => {
    setData(prev => {
      const next = [...prev];
      next[index] = revalidate({ ...next[index], ...updates });
      return next;
    });
  };

  const handleCreateCategory = async (name: string, idx: number) => {
    try {
      const res = await apiClient.post("/categories", { CategoryName: name, IsActive: true });
      if (res.success && res.data) {
        setCategories([...categories, res.data]);
        updateEntry(idx, { CategoryId: res.data.CategoryId, CategoryName: name });
        toast.success(`Category "${name}" added`);
      }
    } catch { toast.error("Error creating category"); }
  };

  const handleCreateCompany = async (name: string, idx: number) => {
    try {
      const res = await apiClient.post("/companies", { CompanyName: name, IsActive: true });
      if (res.success && res.data) {
        setCompanies([...companies, res.data]);
        updateEntry(idx, { CompanyId: res.data.CompanyId, CompanyName: name });
        toast.success(`Company "${name}" added`);
      }
    } catch { toast.error("Error creating company"); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl md:max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
            Preview Medicine Import

            {!allValid && errorCount > 0 && (
              <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal border border-rose-200">
                <AlertTriangle className="w-3 h-3" />
                {errorCount} error{errorCount > 1 ? "s" : ""} — fix before importing
              </span>
            )}
            {allValid && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Ready to Import
              </span>
            )}
            {withStock > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal border border-blue-200">
                <Package className="w-3 h-3" />
                {totalBatches} batch{totalBatches !== 1 ? "es" : ""} across {withStock} medicine{withStock !== 1 ? "s" : ""}
              </span>
            )}
            {willUpdate > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal border border-amber-200">
                <RefreshCw className="w-3 h-3" />
                {willUpdate} existing medicine{willUpdate !== 1 ? "s" : ""} — stock only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[60px] text-center">Row(s)</TableHead>
                <TableHead>Brand Name</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead className="w-[170px]">Category</TableHead>
                <TableHead className="w-[170px]">Company</TableHead>
                <TableHead className="w-[110px]">Unit</TableHead>
                <TableHead className="w-[130px]">Dosage Form</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[50px] text-center">Active</TableHead>
                <TableHead className="w-[200px] bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                  Initial Stock Batches
                </TableHead>
                <TableHead>Errors / Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry, idx) => (
                <TableRow
                  key={idx}
                  className={cn(
                    "align-top",
                    !entry.IsValid
                      ? "bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20"
                      : entry.ExistingMedicineId
                        ? "bg-amber-50/30 hover:bg-amber-50/60 dark:bg-amber-950/10"
                        : ""
                  )}
                >
                  {/* Row numbers */}
                  <TableCell className="text-center py-3 text-muted-foreground text-xs font-medium">
                    {entry.RowNumbers.join(", ")}
                  </TableCell>

                  {/* Brand Name */}
                  <TableCell className="py-3">
                    {entry.ExistingMedicineId ? (
                      <div>
                        <span className="font-semibold">{entry.BrandName}</span>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5" />
                          Existing (ID {entry.ExistingMedicineId})
                        </div>
                      </div>
                    ) : !entry.BrandName ? (
                      <input
                        className="flex h-8 w-full rounded-md border border-rose-500 bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={entry.BrandName}
                        onChange={e => updateEntry(idx, { BrandName: e.target.value })}
                        placeholder="Required"
                      />
                    ) : (
                      <span className="font-semibold">{entry.BrandName}</span>
                    )}
                  </TableCell>

                  {/* Formula */}
                  <TableCell className="py-3">
                    {!entry.GenericName ? (
                      <input
                        className="flex h-8 w-full rounded-md border border-rose-500 bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={entry.GenericName}
                        onChange={e => updateEntry(idx, { GenericName: e.target.value })}
                        placeholder="Required"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">{entry.GenericName}</span>
                    )}
                  </TableCell>

                  {/* Category */}
                  <TableCell className="py-3">
                    {!entry.CategoryId && !entry.ExistingMedicineId ? (
                      <SmartCombobox
                        options={categories.map(c => ({ value: c.CategoryId, label: c.CategoryName }))}
                        value={entry.CategoryId || 0}
                        onChange={val => updateEntry(idx, { CategoryId: Number(val) })}
                        onCreateNew={name => handleCreateCategory(name, idx)}
                        placeholder={entry.CategoryName || "Select/Add..."}
                        className="border-rose-500 h-8"
                      />
                    ) : (
                      <span className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        {categories.find(c => c.CategoryId === entry.CategoryId)?.CategoryName || entry.CategoryName}
                      </span>
                    )}
                  </TableCell>

                  {/* Company */}
                  <TableCell className="py-3">
                    {!entry.CompanyId && !entry.ExistingMedicineId ? (
                      <SmartCombobox
                        options={companies.map(c => ({ value: c.CompanyId, label: c.CompanyName }))}
                        value={entry.CompanyId || 0}
                        onChange={val => updateEntry(idx, { CompanyId: Number(val) })}
                        onCreateNew={name => handleCreateCompany(name, idx)}
                        placeholder={entry.CompanyName || "Select/Add..."}
                        className="border-rose-500 h-8"
                      />
                    ) : (
                      <span className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        {companies.find(c => c.CompanyId === entry.CompanyId)?.CompanyName || entry.CompanyName}
                      </span>
                    )}
                  </TableCell>

                  {/* Unit */}
                  <TableCell className="py-3">
                    <SmartCombobox
                      options={["Box","Strip","Bottle","Tube","Piece","Vial","Ampoule","Sachet","Pack","Jar","Can"].map(u => ({ value: u, label: u }))}
                      value={entry.Unit || ""}
                      onChange={val => updateEntry(idx, { Unit: val as string })}
                      placeholder="Unit"
                      className={!entry.Unit ? "border-rose-500 h-8" : "h-8"}
                    />
                  </TableCell>

                  {/* Dosage Form */}
                  <TableCell className="py-3">
                    <SmartCombobox
                      options={["Tablet","Capsule","Syrup","Suspension","Injection","Cream","Ointment","Drops","Gel","Lotion","Spray","Inhaler","Powder","Suppository","Other"].map(d => ({ value: d, label: d }))}
                      value={entry.DosageForm || ""}
                      onChange={val => updateEntry(idx, { DosageForm: val as string })}
                      placeholder="Dosage"
                      className="h-8"
                    />
                  </TableCell>

                  {/* Status label */}
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {entry.IsActive ? (
                      <span className="text-emerald-600 font-medium">Active</span>
                    ) : (
                      <span className="text-rose-600 font-medium">Inactive</span>
                    )}
                  </TableCell>

                  {/* Active toggle */}
                  <TableCell className="py-3 text-center">
                    <SmartCombobox
                      options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]}
                      value={entry.IsActive ? "true" : "false"}
                      onChange={val => updateEntry(idx, { IsActive: val === "true" })}
                      placeholder="Status"
                      className="h-8"
                    />
                  </TableCell>

                  {/* Initial Stock Batches */}
                  <TableCell className="py-3 bg-emerald-50/50 dark:bg-emerald-950/10">
                    <BatchList batches={entry.InitialBatches} />
                  </TableCell>

                  {/* Errors / Status */}
                  <TableCell className="py-3">
                    {entry.IsValid ? (
                      <div className="space-y-1">
                        {entry.ExistingMedicineId ? (
                          <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            Add Batches Only
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Create New
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full w-fit">
                          Errors Found
                        </span>
                        {entry.Errors.slice(0, 3).map((err, i) => (
                          <span key={i} className="text-[10px] text-rose-600 leading-tight">
                            · {err}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No data to preview.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0 flex items-center justify-between w-full sm:justify-between">
          <div className="text-sm text-muted-foreground space-x-3">
            <span>{data.length} medicine{data.length !== 1 ? "s" : ""}</span>
            {willCreate > 0 && <span className="text-blue-600 font-medium">{willCreate} new</span>}
            {willUpdate > 0 && <span className="text-amber-600 font-medium">{willUpdate} existing (add stock)</span>}
            {errorCount > 0 && <span className="text-rose-600 font-semibold">{errorCount} error{errorCount > 1 ? "s" : ""}</span>}
            {totalBatches > 0 && <span className="text-emerald-600">{totalBatches} batch{totalBatches !== 1 ? "es" : ""}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button
              onClick={() => onConfirm(data)}
              disabled={!allValid || isSaving || data.length === 0}
              className={allValid ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Importing..." : "Confirm & Import"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
