"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface Medicine {
  MedicineId: number;
  BrandName: string;
  GenericName?: string;
  Barcode?: string;
  DefaultCostPrice?: number;
  DefaultSellingPrice?: number;
  IsActive?: boolean;
}

interface ManualEntryItem {
  id: string; // for UI tracking
  MedicineId: number | "";
  MedicineName?: string;
  BatchCode: string;
  Quantity: number | "";
  CostPrice: number | "";
  SellingPrice: number | "";
  ExpiryDate: string;
  ManufacturingDate: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editSessionId?: number | null;
}

const emptyItem = (): ManualEntryItem => ({
  id: Math.random().toString(36).substr(2, 9),
  MedicineId: "",
  MedicineName: "",
  BatchCode: "",
  Quantity: "",
  CostPrice: "",
  SellingPrice: "",
  ExpiryDate: "",
  ManufacturingDate: "",
});

interface MedicineSearchInputProps {
  id: string;
  value: number | "";
  selectedName?: string;
  allMedicines: Medicine[];
  onSelect: (med: Medicine) => void;
  onEnterWhenSelected: () => void;
}

function MedicineSearchInput({
  id,
  value,
  selectedName,
  allMedicines,
  onSelect,
  onEnterWhenSelected,
}: MedicineSearchInputProps) {
  const [inputValue, setInputValue] = useState(selectedName || "");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Medicine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync displayed name when selectedName prop changes (e.g. edit mode loaded)
  useEffect(() => {
    setInputValue(selectedName || "");
  }, [selectedName]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (value && selectedName) {
          setInputValue(selectedName);
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [value, selectedName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const q = val.toLowerCase().trim();

    if (q.length >= 1) {
      if (allMedicines && allMedicines.length > 0) {
        const matches = allMedicines
          .filter(
            (m) =>
              m.BrandName.toLowerCase().includes(q) ||
              (m.GenericName && m.GenericName.toLowerCase().includes(q)) ||
              (m.Barcode && m.Barcode.toLowerCase().includes(q))
          )
          .slice(0, 15);
        setResults(matches);
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        // Fallback to API if allMedicines is still loading
        apiClient
          .get<any>("/medicines", { params: { search: val.trim(), page_size: 15 } })
          .then((res) => {
            if (res.success && res.data) {
              setResults(res.data.filter((m: any) => m.IsActive));
              setIsOpen(true);
              setActiveIndex(0);
            }
          });
      }
    } else {
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleChoose = (med: Medicine) => {
    setInputValue(med.BrandName);
    setIsOpen(false);
    setResults([]);
    onSelect(med);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && inputValue.trim().length >= 1) {
        setIsOpen(true);
      }
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && results.length > 0) {
        const picked = results[activeIndex >= 0 ? activeIndex : 0];
        handleChoose(picked);
      } else if (value) {
        setIsOpen(false);
        onEnterWhenSelected();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Tab") {
      if (isOpen && results.length > 0 && activeIndex >= 0) {
        handleChoose(results[activeIndex]);
      }
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          onKeyDown={handleKeyDown}
          placeholder="Search Medicine..."
          autoComplete="off"
          className="h-9 pl-8 pr-2 text-sm bg-white dark:bg-card border-gray-200 dark:border-border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              No medicines found
            </div>
          ) : (
            results.map((med, idx) => (
              <div
                key={med.MedicineId}
                className={cn(
                  "px-3 py-2 cursor-pointer border-b border-border/40 last:border-0 text-sm flex flex-col transition-colors",
                  activeIndex === idx
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium"
                    : "hover:bg-slate-50 dark:hover:bg-zinc-800 text-foreground"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleChoose(med);
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">{med.BrandName}</span>
                  {med.Barcode && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {med.Barcode}
                    </span>
                  )}
                </div>
                {med.GenericName && (
                  <span className="text-xs text-muted-foreground truncate">
                    {med.GenericName}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ManualEntryModal({ isOpen, onClose, onSuccess, editSessionId }: Props) {
  const [items, setItems] = useState<ManualEntryItem[]>([emptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active medicines for instant search
  const { data: medData } = useSWR("/medicines?page_size=0", async (url) => {
    const res = await apiClient.get<any>(url);
    if (res.success && res.data) {
      return res.data.filter((m: any) => m.IsActive);
    }
    return [];
  });
  const allMedicines: Medicine[] = medData || [];

  const [notes, setNotes] = useState("");
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const focusField = (id: string, select = true) => {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      if (select && el instanceof HTMLInputElement) {
        el.select();
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (editSessionId) {
        setIsLoadingSession(true);
        apiClient
          .get(`/opening-stock/${editSessionId}`)
          .then((res: any) => {
            if (res.success && res.data) {
              setNotes(res.data.Notes || "");
              if (res.data.items && res.data.items.length > 0) {
                setItems(
                  res.data.items.map((item: any) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    MedicineId: item.MedicineId,
                    MedicineName: item.MedicineName,
                    BatchCode: item.BatchCode,
                    Quantity: item.Quantity,
                    CostPrice: item.CostPrice,
                    SellingPrice: item.SellingPrice,
                    ExpiryDate: item.ExpiryDate
                      ? new Date(item.ExpiryDate).toISOString().split("T")[0]
                      : "",
                    ManufacturingDate: item.ManufacturingDate
                      ? new Date(item.ManufacturingDate).toISOString().split("T")[0]
                      : "",
                  }))
                );
              } else {
                setItems([emptyItem()]);
              }
            }
          })
          .catch(() => {
            toast.error("Failed to load session details.");
            setItems([emptyItem()]);
          })
          .finally(() => {
            setIsLoadingSession(false);
          });
      } else {
        const initial = [emptyItem()];
        setItems(initial);
        setNotes("");
        // Auto-focus the search field when Add New opens (do not show all medicines by default)
        setTimeout(() => {
          focusField(`${initial[0].id}-MedicineSearch`);
        }, 100);
      }
    }
  }, [isOpen, editSessionId]);

  if (!isOpen) return null;

  const handleUpdateItem = (id: string, field: keyof ManualEntryItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    const newItem = emptyItem();
    setItems((prev) => [...prev, newItem]);
    setTimeout(() => {
      focusField(`${newItem.id}-MedicineSearch`);
    }, 50);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectMedicine = (itemId: string, med: Medicine) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            MedicineId: med.MedicineId,
            MedicineName: med.BrandName,
            CostPrice:
              item.CostPrice === "" && med.DefaultCostPrice
                ? med.DefaultCostPrice
                : item.CostPrice,
            SellingPrice:
              item.SellingPrice === "" && med.DefaultSellingPrice
                ? med.DefaultSellingPrice
                : item.SellingPrice,
          };
        }
        return item;
      })
    );

    // Smoothly focus Batch Code
    setTimeout(() => {
      focusField(`${itemId}-BatchCode`);
    }, 50);
  };

  const handleFieldKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    itemId: string,
    currentField: string,
    itemIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentField === "BatchCode") {
        focusField(`${itemId}-Quantity`);
      } else if (currentField === "Quantity") {
        focusField(`${itemId}-CostPrice`);
      } else if (currentField === "CostPrice") {
        focusField(`${itemId}-SellingPrice`);
      } else if (currentField === "SellingPrice") {
        focusField(`${itemId}-ExpiryDate`, false);
      } else if (currentField === "ExpiryDate") {
        focusField(`${itemId}-ManufacturingDate`, false);
      } else if (currentField === "ManufacturingDate") {
        if (itemIndex === items.length - 1) {
          handleAddItem();
        } else {
          focusField(`${items[itemIndex + 1].id}-MedicineSearch`);
        }
      }
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    const payloadItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.MedicineId) {
        toast.error(`Row ${i + 1}: Please search and select a medicine.`);
        focusField(`${item.id}-MedicineSearch`);
        return;
      }
      if (!item.BatchCode.trim()) {
        toast.error(`Row ${i + 1}: Batch Number is required.`);
        focusField(`${item.id}-BatchCode`);
        return;
      }
      if (!item.Quantity || Number(item.Quantity) <= 0) {
        toast.error(`Row ${i + 1}: Quantity must be greater than 0.`);
        focusField(`${item.id}-Quantity`);
        return;
      }
      if (item.CostPrice === "" || Number(item.CostPrice) < 0) {
        toast.error(`Row ${i + 1}: Cost Price must be valid.`);
        focusField(`${item.id}-CostPrice`);
        return;
      }
      if (item.SellingPrice === "" || Number(item.SellingPrice) < 0) {
        toast.error(`Row ${i + 1}: Selling Price must be valid.`);
        focusField(`${item.id}-SellingPrice`);
        return;
      }
      if (!item.ExpiryDate) {
        toast.error(`Row ${i + 1}: Expiry Date is required.`);
        focusField(`${item.id}-ExpiryDate`, false);
        return;
      }

      payloadItems.push({
        MedicineId: Number(item.MedicineId),
        BatchCode: item.BatchCode,
        Quantity: Number(item.Quantity),
        CostPrice: Number(item.CostPrice),
        SellingPrice: Number(item.SellingPrice),
        ExpiryDate: item.ExpiryDate,
        ManufacturingDate: item.ManufacturingDate || null,
      });
    }

    setIsSubmitting(true);
    try {
      // 1. Preview/Validate
      const previewRes = await apiClient.post("/opening-stock/preview", {
        items: payloadItems,
      });
      if (!previewRes.success) {
        toast.error(previewRes.error || "Validation failed.");
        setIsSubmitting(false);
        return;
      }

      const previewData = previewRes.data;
      if (previewData.has_errors) {
        const firstError = previewData.items.find((item: any) => item.Error);
        toast.error(`Validation Error: ${firstError?.Error}`);
        setIsSubmitting(false);
        return;
      }

      // 2. Commit or Update
      const commitPayload = {
        idempotency_token: previewData.idempotency_token,
        Notes: notes,
        items: payloadItems,
      };

      let commitRes;
      if (editSessionId) {
        commitRes = await apiClient.put(
          `/opening-stock/${editSessionId}`,
          commitPayload
        );
      } else {
        commitRes = await apiClient.post("/opening-stock", commitPayload);
      }

      if (commitRes.success) {
        toast.success("Opening stock entries saved successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(commitRes.error || "Failed to commit opening stock.");
      }
    } catch (error) {
      toast.error("Network error while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl w-full max-w-[1400px] max-h-[90vh] flex flex-col border border-border">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {editSessionId ? "Edit Opening Stock" : "Add Opening Stock"}
            </h2>
            {editSessionId && (
              <p className="text-sm text-muted-foreground mt-1">
                Editing Session ID: {editSessionId}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-secondary/10 min-h-[50vh] custom-scrollbar">
          {isLoadingSession ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>Loading session details...</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Notes
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes for this session"
                  className="max-w-md bg-white dark:bg-card"
                />
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-3 items-end bg-white dark:bg-card p-4 rounded-xl shadow-sm border border-border relative"
                  >
                    <div className="col-span-12 md:col-span-2 relative z-20">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Medicine
                      </label>
                      <MedicineSearchInput
                        id={`${item.id}-MedicineSearch`}
                        value={item.MedicineId}
                        selectedName={item.MedicineName}
                        allMedicines={allMedicines}
                        onSelect={(med) => handleSelectMedicine(item.id, med)}
                        onEnterWhenSelected={() => focusField(`${item.id}-BatchCode`)}
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Batch Code
                      </label>
                      <Input
                        id={`${item.id}-BatchCode`}
                        value={item.BatchCode}
                        onChange={(e) => handleUpdateItem(item.id, "BatchCode", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, item.id, "BatchCode", index)}
                        placeholder="BATCH123"
                        className="h-9 font-mono"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Qty
                      </label>
                      <Input
                        id={`${item.id}-Quantity`}
                        type="number"
                        value={item.Quantity}
                        onChange={(e) => handleUpdateItem(item.id, "Quantity", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, item.id, "Quantity", index)}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Cost
                      </label>
                      <Input
                        id={`${item.id}-CostPrice`}
                        type="number"
                        step="0.01"
                        value={item.CostPrice}
                        onChange={(e) => handleUpdateItem(item.id, "CostPrice", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, item.id, "CostPrice", index)}
                        placeholder="0.00"
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Selling
                      </label>
                      <Input
                        id={`${item.id}-SellingPrice`}
                        type="number"
                        step="0.01"
                        value={item.SellingPrice}
                        onChange={(e) => handleUpdateItem(item.id, "SellingPrice", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, item.id, "SellingPrice", index)}
                        placeholder="0.00"
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Expiry Date
                      </label>
                      <Input
                        id={`${item.id}-ExpiryDate`}
                        type="date"
                        value={item.ExpiryDate}
                        onChange={(e) => handleUpdateItem(item.id, "ExpiryDate", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, item.id, "ExpiryDate", index)}
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-5 md:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Mfg Date (Opt)
                      </label>
                      <Input
                        id={`${item.id}-ManufacturingDate`}
                        type="date"
                        value={item.ManufacturingDate}
                        onChange={(e) => handleUpdateItem(item.id, "ManufacturingDate", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, item.id, "ManufacturingDate", index)}
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-9 w-9 p-0"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length === 1}
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={handleAddItem}
                  className="w-full border-dashed border-2 py-6 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Another Row
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 bg-white dark:bg-card">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] font-semibold"
          >
            {isSubmitting ? "Saving..." : "Save Opening Stock"}
          </Button>
        </div>
      </div>
    </div>
  );
}
