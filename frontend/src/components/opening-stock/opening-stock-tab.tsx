"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  PackagePlus, 
  Upload, 
  Download, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Search,
  Check,
  Plus,
  Pencil,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiClient, getApiBaseUrl, getAccessToken } from "@/lib/api-client";
import { toast } from "sonner";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { ManualEntryModal } from "./manual-entry-modal";
import { ImportPreviewModal, PreviewItem } from "./import-preview-modal";

export interface EntrySummary {
  EntryId: number;
  ReferenceNo: string;
  TotalItems: number;
  TotalQuantity: number;
  TotalValue: number;
  Status: string;
  EntryDate: string;
  CreatedByName: string;
  Medicines?: string[];
  BatchCodes?: string[];
}

export interface DetailItem {
  MedicineName: string;
  MedicineId: number;
  BatchCode: string;
  Quantity: number;
  CostPrice: number;
  SellingPrice: number;
  ExpiryDate: string;
  ManufacturingDate?: string | null;
}

export interface EntryDetail {
  EntryId: number;
  ReferenceNo: string;
  Notes: string | null;
  Status: string;
  EntryDate: string;
  CreatedByName: string;
  TotalItems: number;
  TotalQuantity?: number;
  TotalValue: number;
  VoidedAt: string | null;
  VoidedByName: string | null;
  items: DetailItem[];
}

export function OpeningStockTab() {
  const { formatCurrency, triggerNotification } = useSystemPreferences();
  const { profile } = useProfile();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Views: 'list' | 'detail'
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  // --- Modals State ---
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editSessionId, setEditSessionId] = useState<number | null>(null);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [sessionToVoid, setSessionToVoid] = useState<{ EntryId: number; ReferenceNo: string } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewSummary, setPreviewSummary] = useState({ total_items: 0, total_value: 0, has_errors: false });
  const [previewToken, setPreviewToken] = useState("");

  // --- List View State ---
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetcher = async (url: string) => {
    const res = await apiClient.get<any>(url);
    if (!res.success) throw new Error(res.error);
    return res;
  };

  const { data: listRes, mutate: mutateList, isLoading: isListLoading } = useSWR(
    view === 'list' ? `/opening-stock?page=${page}&page_size=${pageSize}` : null,
    fetcher
  );
  
  const entries: EntrySummary[] = listRes?.data || [];
  const totalEntries = listRes?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  // --- Detail View State ---
  const { data: detailRes, mutate: mutateDetail, isLoading: isDetailLoading } = useSWR(
    (view === 'detail' && selectedEntryId) ? `/opening-stock/${selectedEntryId}` : null,
    fetcher
  );
  const detailData: EntryDetail | null = detailRes?.data || null;
  const [isVoiding, setIsVoiding] = useState(false);

  // --- Handlers ---
  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    const url = `${getApiBaseUrl()}/opening-stock/template?format=${format}`;
    const token = getAccessToken();
    
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error("Failed to download template");
        return res.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `opening_stock_template.${format}`;
        a.click();
      })
      .catch(err => {
        toast.error("Template download failed: " + err.message);
      });
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const url = `${getApiBaseUrl()}/opening-stock/export?format=${format}`;
    const token = getAccessToken();
    
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error("Failed to export data");
        return res.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `opening_stock_export.${format}`;
        a.click();
      })
      .catch(err => {
        toast.error("Export failed: " + err.message);
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast.error("Only CSV or XLSX files are allowed");
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const importRes = await fetch(`${getApiBaseUrl()}/opening-stock/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: formData
      });
      const importData = await importRes.json();
      
      if (!importRes.ok || !importData.success) {
        throw new Error(importData.detail || importData.error || "Failed to parse file");
      }

      if (importData.data.parse_errors && importData.data.parse_errors.length > 0) {
        toast.error("File contains structural errors", {
          description: importData.data.parse_errors[0]
        });
        return;
      }

      // Preview (Validate)
      const parsedItems = importData.data.parsed_items;
      const previewRes = await apiClient.post('/opening-stock/preview', {
        items: parsedItems
      });

      if (previewRes.success) {
        setPreviewItems(previewRes.data.items);
        setPreviewToken(previewRes.data.idempotency_token);
        setPreviewSummary({
          total_items: previewRes.data.total_items,
          total_value: previewRes.data.total_value,
          has_errors: previewRes.data.has_errors
        });
        setIsPreviewModalOpen(true);
      } else {
        throw new Error(previewRes.error || "Failed to generate preview");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
      // Reset input value to allow uploading the same file again
      e.target.value = '';
    }
  };

  const handleConfirmVoid = async () => {
    if (!sessionToVoid) return;
    setIsVoiding(true);
    try {
      const res = await apiClient.post(`/opening-stock/${sessionToVoid.EntryId}/void`, {});
      if (res.success) {
        triggerNotification('success', 'AlertTriggerSale', res.message || "Opening Stock session voided successfully");
        toast.success(res.message || "Opening Stock session voided successfully");
        setIsVoidDialogOpen(false);
        setSessionToVoid(null);
        mutateList();
        if (selectedEntryId === sessionToVoid.EntryId) {
          mutateDetail();
        }
      } else {
        toast.error(res.error || "Failed to void session", { duration: 8000 });
      }
    } catch (err: any) {
      toast.error(err?.message || "Network or server error during void");
    } finally {
      setIsVoiding(false);
    }
  };

  const handleEditSession = (id: number) => {
    setEditSessionId(id);
    setIsManualModalOpen(true);
  };

  const openDetail = (id: number) => {
    setSelectedEntryId(id);
    setView('detail');
  };

  const closeDetail = () => {
    setView('list');
    setSelectedEntryId(null);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm flex flex-col h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-secondary/20 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-indigo-500" />
              Opening Stock Sessions
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record existing physical stock. Safe, idempotent bulk imports with atomic rollback.
            </p>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={() => { setEditSessionId(null); setIsManualModalOpen(true); }} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold">
              <Plus className="mr-2 h-4 w-4" /> Add New
            </Button>
            
            <input 
              id="csv-upload" 
              type="file" 
              accept=".csv,.xlsx" 
              className="hidden" 
              onChange={handleFileUpload}
            />
            
            <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={() => handleDownloadTemplate('csv')}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={() => document.getElementById('csv-upload')?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? "Importing..." : "Import CSV"}
            </Button>
            <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={() => handleExport('csv')}>
              <Upload className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10 bg-white dark:bg-card">
              <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <th className="px-4 py-3 font-semibold">Reference No.</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Medicine</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold text-center">Total Quantity</th>
                <th className="px-4 py-3 font-semibold text-center">Total Value</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isListLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                    Loading sessions...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No opening stock sessions found.
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.EntryId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{entry.ReferenceNo}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(entry.EntryDate), "dd MMM yyyy HH:mm")}</td>
                    <td className="px-4 py-3">
                      {entry.Medicines && entry.Medicines.length > 0 ? (
                        <div className="flex items-center gap-1.5" title={entry.Medicines.join(", ")}>
                          <span className="font-medium text-foreground truncate max-w-[160px]">
                            {entry.Medicines[0]}
                          </span>
                          {entry.Medicines.length > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                              +{entry.Medicines.length - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.BatchCodes && entry.BatchCodes.length > 0 ? (
                        <div className="flex items-center gap-1.5" title={entry.BatchCodes.join(", ")}>
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                            {entry.BatchCodes[0]}
                          </span>
                          {entry.BatchCodes.length > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                              +{entry.BatchCodes.length - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-foreground">
                      {entry.TotalQuantity ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(entry.TotalValue)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.Status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                          <XCircle className="h-3.5 w-3.5" />
                          Voided
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3 text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => openDetail(entry.EntryId)}
                          className="hover:text-primary transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {isAdmin && entry.Status === 'ACTIVE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditSession(entry.EntryId)}
                              className="hover:text-blue-500 transition-colors cursor-pointer"
                              title="Edit Session"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSessionToVoid(entry);
                                setIsVoidDialogOpen(true);
                              }}
                              className="hover:text-rose-500 transition-colors cursor-pointer"
                              title="Void / Delete Session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="px-4 py-3 border-t border-border bg-white dark:bg-card flex flex-col sm:flex-row items-center justify-between text-sm text-slate-500 dark:text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder="25" /></SelectTrigger>
                <SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Showing {totalEntries === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalEntries)} of {totalEntries}
              </span>
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" size="sm" className="h-8 px-3"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <Button 
                  variant="outline" size="sm" className="h-8 px-3"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        <ManualEntryModal 
          isOpen={isManualModalOpen} 
          onClose={() => {
            setIsManualModalOpen(false);
            setEditSessionId(null);
          }} 
          onSuccess={mutateList} 
          editSessionId={editSessionId}
        />
        
        <ImportPreviewModal 
          isOpen={isPreviewModalOpen} 
          onClose={() => setIsPreviewModalOpen(false)} 
          onSuccess={mutateList} 
          previewItems={previewItems}
          previewSummary={previewSummary}
          previewToken={previewToken}
        />
      </div>
      {/* --- DETAIL VIEW MODAL --- */}
      <Dialog open={view === 'detail'} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-white dark:bg-card rounded-2xl gap-0">
          <DialogHeader className="p-6 border-b border-border bg-slate-50/50 dark:bg-secondary/10 relative">
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              Opening Stock Session Details
            </DialogTitle>
          </DialogHeader>

          {isDetailLoading || !detailData ? (
            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin opacity-50 mb-4" />
              <p>Loading session details...</p>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto custom-scrollbar p-6">
              {/* Void button moved to footer */}
              {detailData.Status === 'VOIDED' && detailData.VoidedAt && (
                <div className="bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-rose-800 dark:text-rose-400">Voided on {format(new Date(detailData.VoidedAt), "dd MMM yyyy, HH:mm")}</div>
                    <div className="text-sm text-rose-600 dark:text-rose-300 mt-0.5">by {detailData.VoidedByName}</div>
                    <p className="text-xs text-rose-500 mt-1">This session's quantities have been permanently reversed.</p>
                  </div>
                </div>
              )}

              {/* Clean Grid Layout like Medicine Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-6 border-b border-border pb-6 mb-6">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Reference No.</div>
                  <div className="text-base font-bold text-foreground font-mono">{detailData.ReferenceNo}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Status</div>
                  <div>
                    {detailData.Status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                        <XCircle className="h-3.5 w-3.5" />
                        Voided
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Created At</div>
                  <div className="text-sm font-medium text-foreground">{format(new Date(detailData.EntryDate), "dd MMM yyyy, HH:mm")}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Created By</div>
                  <div className="text-sm font-medium text-foreground">{detailData.CreatedByName}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Total Quantity</div>
                  <div className="text-base font-bold text-foreground">
                    {detailData.TotalQuantity ?? detailData.items.reduce((sum, item) => sum + (item.Quantity || 0), 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Total Value</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(detailData.TotalValue)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Notes</div>
                  <div className="text-sm text-foreground">{detailData.Notes || <span className="text-muted-foreground italic">No notes provided</span>}</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Included Items ({detailData.items.length})</h3>
                <div className="border border-border rounded-xl overflow-x-auto custom-scrollbar shadow-sm">
                  <table className="w-full text-left text-sm border-collapse min-w-[750px]">
                    <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Medicine</th>
                        <th className="px-4 py-3 font-semibold">Batch</th>
                        <th className="px-4 py-3 font-semibold">Expiry Date</th>
                        <th className="px-4 py-3 font-semibold">Mfg Date</th>
                        <th className="px-4 py-3 font-semibold text-right">Qty</th>
                        <th className="px-4 py-3 font-semibold text-right">Cost Price</th>
                        <th className="px-4 py-3 font-semibold text-right">Selling Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailData.items.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-muted/30 transition-colors ${detailData.Status === 'VOIDED' ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{item.MedicineName}</div>
                            <div className="text-xs text-muted-foreground">ID: {item.MedicineId}</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">{item.BatchCode}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {item.ExpiryDate ? format(new Date(item.ExpiryDate), "dd MMM yyyy") : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {item.ManufacturingDate ? format(new Date(item.ManufacturingDate), "dd MMM yyyy") : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">{item.Quantity}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.CostPrice)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.SellingPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
          
          <DialogFooter className="p-6 border-t border-border bg-slate-50/50 dark:bg-secondary/10 flex sm:justify-between items-center w-full">
            {detailData && detailData.Status === 'ACTIVE' && isAdmin ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSessionToVoid({ EntryId: detailData.EntryId, ReferenceNo: detailData.ReferenceNo });
                  setIsVoidDialogOpen(true);
                }}
                disabled={isVoiding}
                className="shadow-sm bg-rose-600 hover:bg-rose-700 text-white"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Void Session
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={closeDetail} variant="default" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-semibold">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void / Delete Confirmation Dialog */}
      <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-rose-500/20">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirm Void / Delete
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-foreground/80 space-y-2">
            <p>
              Are you sure you want to void session <strong className="font-mono">{sessionToVoid?.ReferenceNo}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All batches created by this session will be safely reversed and audited.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsVoidDialogOpen(false)}
              disabled={isVoiding}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmVoid}
              disabled={isVoiding}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isVoiding ? "Voiding..." : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
