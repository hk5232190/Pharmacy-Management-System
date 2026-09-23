"use client";

import React, { useState } from "react";
import { X, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
import { format } from "date-fns";

export interface PreviewItem {
  MedicineId: number;
  MedicineName: string;
  BatchCode: string;
  Quantity: number;
  CostPrice: number;
  SellingPrice: number;
  ExpiryDate: string;
  ManufacturingDate: string | null;
  Error: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  previewItems: PreviewItem[];
  previewSummary: { total_items: number, total_value: number, has_errors: boolean };
  previewToken: string;
}

export function ImportPreviewModal({ isOpen, onClose, onSuccess, previewItems, previewSummary, previewToken }: Props) {
  const { formatCurrency } = useSystemPreferences();
  const [notes, setNotes] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

  if (!isOpen) return null;

  const handleCommit = async () => {
    if (previewSummary.has_errors) {
      toast.error("Cannot commit with validation errors. Please fix the file and try again.");
      return;
    }
    
    setIsCommitting(true);
    try {
      // Reconstruct the exact validated payload
      const payloadItems = previewItems.map(p => ({
        MedicineId: p.MedicineId,
        BatchCode: p.BatchCode,
        Quantity: p.Quantity,
        CostPrice: p.CostPrice,
        SellingPrice: p.SellingPrice,
        ExpiryDate: p.ExpiryDate,
        ManufacturingDate: p.ManufacturingDate
      }));

      const res = await apiClient.post('/opening-stock', {
        Notes: notes || null,
        idempotency_token: previewToken,
        items: payloadItems
      });

      if (res.success) {
        toast.success("Opening stock imported successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to commit opening stock");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while submitting.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Preview Import</h2>
            <p className="text-sm text-gray-500 mt-1">Review the data before committing to the database</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Total Items to Import</div>
              <div className="text-2xl font-bold text-gray-800">{previewSummary.total_items}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Total Value Added</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(previewSummary.total_value)}</div>
            </div>
            <div className={`bg-white rounded-xl p-4 border shadow-sm ${previewSummary.has_errors ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="text-sm text-gray-500 mb-1">Validation Status</div>
              <div className="flex items-center gap-2">
                {previewSummary.has_errors ? (
                  <>
                    <XCircle className="h-6 w-6 text-red-500" />
                    <span className="text-xl font-bold text-red-700">Errors Found</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <span className="text-xl font-bold text-emerald-700">Ready to Import</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 border-b">
                  <tr>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Cost / Selling</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3 max-w-xs">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewItems.map((item, idx) => (
                    <tr key={idx} className={item.Error ? "bg-red-50/50" : "hover:bg-gray-50/50"}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.MedicineName}</div>
                        <div className="text-xs text-gray-500">ID: {item.MedicineId}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{item.BatchCode}</td>
                      <td className="px-4 py-3">{item.Quantity}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{formatCurrency(item.CostPrice)}</div>
                        <div className="text-xs text-gray-500">{formatCurrency(item.SellingPrice)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{format(new Date(item.ExpiryDate), "dd MMM yyyy")}</div>
                        {item.ManufacturingDate && (
                          <div className="text-xs text-gray-500">Mfg: {format(new Date(item.ManufacturingDate), "dd MMM yyyy")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {item.Error ? (
                          <div className="flex items-start gap-1 text-red-600 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{item.Error}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Internal Notes (Optional)</label>
            <Input 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="e.g. Initial inventory count from main warehouse"
              className="max-w-md"
            />
          </div>

        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <Button variant="outline" onClick={onClose} disabled={isCommitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleCommit} 
            disabled={isCommitting || previewSummary.has_errors}
            className={previewSummary.has_errors ? "bg-gray-300" : "bg-indigo-600 hover:bg-indigo-700 text-white"}
          >
            {isCommitting ? "Importing..." : "Confirm & Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
