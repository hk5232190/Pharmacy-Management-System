"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { apiClient, API_BASE_URL, getAccessToken } from "@/lib/api-client";

export interface MasterEntity {
  [key: string]: unknown;
}

function asRecord<T extends object>(value: T): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export interface UseMasterCRUDConfig<T extends object> {
  endpoint: string;
  entityName: string;
  idField: string;
  nameField?: string;
  defaultItem: Partial<T>;
  exportFilename: string;
  validate?: (item: Partial<T>) => string | null;
}

export interface UseMasterCRUDReturn<T extends object> {
  items: T[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  page: number;
  setPage: (v: number | ((p: number) => number)) => void;
  pageSize: number;
  setPageSize: (v: number) => void;
  totalRecords: number;
  selectedIds: Set<number>;
  setSelectedIds: (v: Set<number>) => void;
  allSelected: boolean;
  someSelected: boolean;
  toggleSelectAll: () => void;
  toggleSelect: (id: number) => void;
  isDialogOpen: boolean;
  setIsDialogOpen: (v: boolean) => void;
  isViewDialogOpen: boolean;
  setIsViewDialogOpen: (v: boolean) => void;
  currentItem: Partial<T>;
  setCurrentItem: (v: Partial<T> | ((prev: Partial<T>) => Partial<T>)) => void;
  isSaving: boolean;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (v: boolean) => void;
  itemToDelete: T | null;
  isDeleting: boolean;
  isImporting: boolean;
  isExporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  fetchItems: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleToggleStatus: (id: number) => Promise<void>;
  handleExport: () => Promise<void>;
  handleImportClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  openNewDialog: () => void;
  openEditDialog: (item: T) => void;
  openViewDialog: (item: T) => void;
  openDeleteDialog: (item: T) => void;
}

export function useMasterCRUD<T extends object>(
  config: UseMasterCRUDConfig<T>
): UseMasterCRUDReturn<T> {
  const { endpoint, entityName, idField, defaultItem, exportFilename } = config;
  const nameField = config.nameField ?? "Name";

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<T>>(defaultItem);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => asRecord(item)[idField] as number)));
    }
  }, [allSelected, items, idField]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean | null | undefined> = { page, page_size: pageSize };
      if (search) params.search = search;
      if (filterStatus !== "all") params.status = filterStatus;

      const data = await apiClient.get(`/${endpoint}`, { params });
      if (data.success) {
        setItems(data.data);
        setTotalRecords(data.total || 0);
        setSelectedIds(new Set());
      } else {
        toast.error(`Failed to load ${entityName}s`);
      }
    } catch {
      toast.error(`Network error while loading ${entityName}s`);
    } finally {
      setLoading(false);
    }
  }, [endpoint, entityName, page, pageSize, search, filterStatus]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterStatus, page, pageSize, fetchItems]);

  useEffect(() => {
    const handleRefresh = () => fetchItems();
    window.addEventListener("refresh-masters-tab", handleRefresh);
    return () => window.removeEventListener("refresh-masters-tab", handleRefresh);
  }, [fetchItems]);

  const handleToggleStatus = useCallback(async (id: number) => {
    try {
      const data = await apiClient.put(`/${endpoint}/${id}/status`);
      if (data.success) {
        toast.success(data.message);
        setItems((prev) =>
          prev.map((item) => {
            const record = asRecord(item);
            return record[idField] === id ? { ...item, IsActive: !record.IsActive } : item;
          })
        );
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to toggle status");
    }
  }, [endpoint, idField]);

  const handleSave = useCallback(async () => {
    if (config.validate) {
      const error = config.validate(currentItem);
      if (error) {
        toast.error(error);
        return;
      }
    } else {
      const name = asRecord(currentItem as object)[nameField] as string;
      if (!name?.trim()) {
        toast.error(`${entityName} name is required`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const isEditing = !!asRecord(currentItem as object)[idField];
      const url = isEditing
        ? `/${endpoint}/${asRecord(currentItem as object)[idField]}`
        : `/${endpoint}`;

      const data = isEditing
        ? await apiClient.put(url, currentItem)
        : await apiClient.post(url, currentItem);

      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchItems();
      } else {
        toast.error(data.error || `Failed to save ${entityName.toLowerCase()}`);
      }
    } catch {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  }, [currentItem, idField, endpoint, entityName, fetchItems, config, nameField]);

  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const data = await apiClient.delete(`/${endpoint}/${asRecord(itemToDelete)[idField]}`);
      if (data.success) {
        toast.success(data.message || `${entityName} deleted successfully`);
        setIsDeleteDialogOpen(false);
        fetchItems();
      } else {
        toast.error(data.error || `Failed to delete ${entityName.toLowerCase()}`);
      }
    } catch {
      toast.error("Network error while deleting");
    } finally {
      setIsDeleting(false);
    }
  }, [itemToDelete, endpoint, idField, entityName, fetchItems]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating CSV from server...");
    try {
      const res = await fetch(`${API_BASE_URL}/${endpoint}/export`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.dismiss(toastId);
      setTimeout(() => toast.success(`${entityName}s exported successfully!`), 1000);
    } catch {
      toast.dismiss(toastId);
      toast.error(`Failed to export ${entityName.toLowerCase()}s`);
    } finally {
      setIsExporting(false);
    }
  }, [endpoint, entityName, exportFilename]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiClient.post(`/${endpoint}/import`, formData);
      if (data.success || data.data) {
        toast.success(`Imported: ${data.data.imported_count}, Skipped: ${data.data.skipped_count}`);
        if (data.data.errors?.length > 0) {
          console.warn("Import errors:", data.data.errors);
          toast.error(`There were ${data.data.errors.length} errors. Check console.`);
        }
        fetchItems();
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [endpoint, fetchItems]);

  const openNewDialog = useCallback(() => {
    setCurrentItem(defaultItem);
    setIsDialogOpen(true);
  }, [defaultItem]);

  const openEditDialog = useCallback((item: T) => {
    setCurrentItem(item);
    setIsDialogOpen(true);
  }, []);

  const openViewDialog = useCallback((item: T) => {
    setCurrentItem(item);
    setIsViewDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((item: T) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  }, []);

  return {
    items,
    loading,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalRecords,
    selectedIds,
    setSelectedIds,
    allSelected,
    someSelected,
    toggleSelectAll,
    toggleSelect,
    isDialogOpen,
    setIsDialogOpen,
    isViewDialogOpen,
    setIsViewDialogOpen,
    currentItem,
    setCurrentItem,
    isSaving,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    itemToDelete,
    isDeleting,
    isImporting,
    isExporting,
    fileInputRef,
    fetchItems,
    handleSave,
    handleDelete,
    handleToggleStatus,
    handleExport,
    handleImportClick,
    handleFileChange,
    openNewDialog,
    openEditDialog,
    openViewDialog,
    openDeleteDialog,
  };
}
