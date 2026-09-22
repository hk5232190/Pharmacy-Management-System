"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: any[];
  categories: any[];
  companies: any[];
  onConfirm: (validData: any[]) => void;
  isSaving: boolean;
  setCategories: (c: any) => void;
  setCompanies: (c: any) => void;
}

export function ImportPreviewModal({ 
  isOpen, 
  onClose, 
  initialData, 
  categories, 
  companies, 
  onConfirm, 
  isSaving,
  setCategories,
  setCompanies
}: ImportPreviewModalProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const allValid = data.length > 0 && data.every(row => row.IsValid);

  const updateRow = (index: number, updates: any) => {
    const newData = [...data];
    const row = { ...newData[index], ...updates };
    
    // Re-validate row
    row.Errors = [];
    row.IsValid = true;
    
    if (!row.BrandName) { row.IsValid = false; row.Errors.push("Brand Name is required"); }
    if (!row.GenericName) { row.IsValid = false; row.Errors.push("Formula is required"); }
    if (!row.CategoryId) { row.IsValid = false; row.Errors.push("Category is required"); }
    if (!row.CompanyId) { row.IsValid = false; row.Errors.push("Company is required"); }
    if (!row.Unit) { row.IsValid = false; row.Errors.push("Unit is required"); }
    if (!row.DosageForm) { row.IsValid = false; row.Errors.push("Dosage Form is required"); }
    
    newData[index] = row;
    setData(newData);
  };

  const handleCreateCategory = async (name: string, rowIndex: number) => {
    try {
      const res = await apiClient.post("/categories", { CategoryName: name, IsActive: true });
      if (res.success && res.data) {
        setCategories([...categories, res.data]);
        updateRow(rowIndex, { CategoryId: res.data.CategoryId, CategoryName: name });
        toast.success(`Category "${name}" added`);
      }
    } catch (error) {
      toast.error("Error creating category");
    }
  };

  const handleCreateCompany = async (name: string, rowIndex: number) => {
    try {
      const res = await apiClient.post("/companies", { CompanyName: name, IsActive: true });
      if (res.success && res.data) {
        setCompanies([...companies, res.data]);
        updateRow(rowIndex, { CompanyId: res.data.CompanyId, CompanyName: name });
        toast.success(`Company "${name}" added`);
      }
    } catch (error) {
      toast.error("Error creating company");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl md:max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            Preview Medicine Import
            {!allValid && (
              <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal ml-2 border border-rose-200">
                <AlertTriangle className="w-3 h-3" />
                Please fix errors before importing
              </span>
            )}
            {allValid && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal ml-2 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Ready to Import
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center">Row</TableHead>
                <TableHead>Brand Name</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead className="w-[180px]">Category</TableHead>
                <TableHead className="w-[180px]">Company</TableHead>
                <TableHead className="w-[120px]">Unit</TableHead>
                <TableHead className="w-[140px]">Dosage Form</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={idx} className={cn(!row.IsValid && "bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20")}>
                  <TableCell className="text-center font-medium text-muted-foreground">{row.RowNumber}</TableCell>
                  
                  <TableCell>
                    {!row.BrandName ? (
                      <input 
                        className="flex h-8 w-full rounded-md border border-rose-500 bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={row.BrandName}
                        onChange={e => updateRow(idx, {BrandName: e.target.value})}
                        placeholder="Required"
                      />
                    ) : (
                      <span className="font-semibold">{row.BrandName}</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {!row.GenericName ? (
                      <input 
                        className="flex h-8 w-full rounded-md border border-rose-500 bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={row.GenericName}
                        onChange={e => updateRow(idx, {GenericName: e.target.value})}
                        placeholder="Required"
                      />
                    ) : (
                      <span className="text-muted-foreground">{row.GenericName}</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {!row.CategoryId ? (
                      <SmartCombobox
                        options={categories.map(c => ({ value: c.CategoryId, label: c.CategoryName }))}
                        value={row.CategoryId || 0}
                        onChange={val => updateRow(idx, { CategoryId: Number(val) })}
                        onCreateNew={(name) => handleCreateCategory(name, idx)}
                        placeholder={row.CategoryName || "Select/Add..."}
                        className="border-rose-500 h-8"
                      />
                    ) : (
                      <span className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {categories.find(c => c.CategoryId === row.CategoryId)?.CategoryName || row.CategoryName}
                      </span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {!row.CompanyId ? (
                      <SmartCombobox
                        options={companies.map(c => ({ value: c.CompanyId, label: c.CompanyName }))}
                        value={row.CompanyId || 0}
                        onChange={val => updateRow(idx, { CompanyId: Number(val) })}
                        onCreateNew={(name) => handleCreateCompany(name, idx)}
                        placeholder={row.CompanyName || "Select/Add..."}
                        className="border-rose-500 h-8"
                      />
                    ) : (
                      <span className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {companies.find(c => c.CompanyId === row.CompanyId)?.CompanyName || row.CompanyName}
                      </span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <SmartCombobox
                      options={[
                        "Box", "Strip", "Bottle", "Tube", "Piece", 
                        "Vial", "Ampoule", "Sachet", "Pack", "Jar", "Can"
                      ].map(u => ({ value: u, label: u }))}
                      value={row.Unit || ""}
                      onChange={val => updateRow(idx, { Unit: val })}
                      placeholder="Select Unit"
                      className={!row.Unit ? "border-rose-500 h-8" : "h-8"}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <SmartCombobox
                      options={[
                        "Tablet", "Capsule", "Syrup", "Suspension", "Injection", 
                        "Cream", "Ointment", "Drops", "Gel", "Lotion", "Spray", 
                        "Inhaler", "Powder", "Suppository", "Other"
                      ].map(d => ({ value: d, label: d }))}
                      value={row.DosageForm || ""}
                      onChange={val => updateRow(idx, { DosageForm: val })}
                      placeholder="Select Dosage"
                      className={!row.DosageForm ? "border-rose-500 h-8" : "h-8"}
                    />
                  </TableCell>

                  <TableCell>
                    <SmartCombobox
                      options={[
                        { value: "true", label: "Active" },
                        { value: "false", label: "Inactive" }
                      ]}
                      value={row.IsActive ? "true" : "false"}
                      onChange={val => updateRow(idx, { IsActive: val === "true" })}
                      placeholder="Select Status"
                      className="h-8"
                    />
                  </TableCell>
                  
                  <TableCell>
                    {row.IsValid ? (
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Valid</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full w-fit">Errors Found</span>
                        <span className="text-[10px] text-rose-600 max-w-[120px] leading-tight">
                          {row.Errors[0]}
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No data to preview.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0 flex items-center justify-between w-full sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {data.length} Total Rows | <span className={allValid ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
              {data.filter(r => !r.IsValid).length} Errors
            </span>
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
