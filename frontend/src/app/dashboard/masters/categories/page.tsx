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

interface Category {
  CategoryId: number;
  CategoryName: string;
  IsActive: boolean;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({ CategoryName: "", IsActive: true });
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get("/categories", { params: search ? { search } : undefined });
      if (data.success) {
        setCategories(data.data);
      } else {
        toast.error("Failed to load categories");
      }
    } catch (error) {
      toast.error("Network error while loading categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchCategories();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (id: number) => {
    try {
      const data = await apiClient.put(`/categories/${id}/status`);
      if (data.success) {
        toast.success(data.message);
        setCategories(categories.map(c => c.CategoryId === id ? { ...c, IsActive: !c.IsActive } : c));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentCategory.CategoryName?.trim()) {
      toast.error("Category name is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const isEditing = !!currentCategory.CategoryId;
      const url = isEditing 
        ? `/categories/${currentCategory.CategoryId}`
        : `/categories`;
      
      const data = isEditing 
        ? await apiClient.put(url, currentCategory)
        : await apiClient.post(url, currentCategory);
      
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchCategories(); // Reload list
      } else {
        toast.error(data.error || "Failed to save category");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const openNewDialog = () => {
    setCurrentCategory({ CategoryName: "", IsActive: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setCurrentCategory(category);
    setIsDialogOpen(true);
  };

  const openViewDialog = (category: Category) => {
    setCurrentCategory(category);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const data = await apiClient.delete(`/categories/${categoryToDelete.CategoryId}`);
      if (data.success) {
        toast.success(data.message || "Category deleted successfully");
        setIsDeleteDialogOpen(false);
        fetchCategories(); // Reload list
      } else {
        toast.error(data.error || "Failed to delete category");
      }
    } catch (error) {
      toast.error("Network error while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating CSV from server...");
    
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/categories/export", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "categories_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Dismiss the loading toast. 
      toast.dismiss(toastId);
      
      // Add a small delay so the success message appears after the OS File Explorer 
      // opens, giving the illusion of completing the export.
      setTimeout(() => {
        toast.success("Categories exported successfully!");
      }, 1000);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to export categories");
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/categories/import", {
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
        fetchCategories(); // Reload
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="relative w-full sm:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search categories..." 
            className="pl-9 h-10 w-full bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={openNewDialog} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
          
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleImportClick} disabled={isImporting}>
            <Download className="mr-2 h-4 w-4" /> {isImporting ? "Importing..." : "Import"}
          </Button>
          <Button variant="outline" className="h-10 bg-background text-foreground hidden sm:flex" onClick={handleExport} disabled={isExporting}>
            <Upload className="mr-2 h-4 w-4" /> {isExporting ? "Exporting..." : "Export"}
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchCategories} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
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
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Category Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading categories...</TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No categories found.</TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.CategoryId} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="text-center"><Checkbox /></TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">
                      CAT-{category.CategoryId.toString().padStart(5, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {category.CategoryName}
                    </TableCell>
                    <TableCell className="text-center">
                      <button 
                        onClick={() => handleToggleStatus(category.CategoryId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          category.IsActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {category.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button onClick={() => openViewDialog(category)} className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(category)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => openDeleteDialog(category)} className="hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
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
            <DialogTitle>{currentCategory.CategoryId ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category Name</label>
              <Input 
                value={currentCategory.CategoryName || ""}
                onChange={e => setCurrentCategory({...currentCategory, CategoryName: e.target.value})}
                placeholder="e.g. Analgesics"
                className="h-11"
              />
            </div>
            {!currentCategory.CategoryId && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox 
                  id="isActive" 
                  checked={currentCategory.IsActive} 
                  onCheckedChange={(c) => setCurrentCategory({...currentCategory, IsActive: c as boolean})}
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
              {isSaving ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Category Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Category Code</p>
              <p className="font-mono text-lg font-semibold">
                CAT-{currentCategory.CategoryId?.toString().padStart(5, '0')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Category Name</p>
              <p className="text-lg font-medium">{currentCategory.CategoryName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="flex items-center">
                <span className={cn(
                  "px-3 py-1 text-[13px] font-bold rounded-full",
                  currentCategory.IsActive 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                )}>
                  {currentCategory.IsActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-rose-500/20">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-foreground/80">
            <p>Are you absolutely sure you want to delete the category <strong>{categoryToDelete?.CategoryName}</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">This action is irreversible. It will be permanently removed from the database.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white">
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
