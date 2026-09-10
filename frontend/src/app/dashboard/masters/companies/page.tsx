"use client";

import { Search, Plus, Download, Upload, RefreshCcw, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMasterCRUD } from "@/hooks/useMasterCRUD";

interface Company {
  CompanyId: number;
  CompanyName: string;
  ContactPerson?: string;
  Phone?: string;
  Address?: string;
  IsActive: boolean;
  TotalProducts?: number;
}

const DEFAULT_COMPANY: Partial<Company> = { CompanyName: "", ContactPerson: "", Phone: "", Address: "", IsActive: true };

export default function CompaniesPage() {
  const {
    items: companies,
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
  } = useMasterCRUD<Company>({
    endpoint: "companies",
    entityName: "Company",
    idField: "CompanyId",
    nameField: "CompanyName",
    defaultItem: DEFAULT_COMPANY,
    exportFilename: "companies_export.csv",
  });

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies by name or phone..."
              className="pl-9 h-10 w-full bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
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
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchItems} disabled={loading}>
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
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-10 text-center">#</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32">Code</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-1/4">Company Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-1/4">Contact Person</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32">Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Address / City</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-36 text-center">Total Products</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">Loading companies...</TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No companies found.</TableCell>
                </TableRow>
              ) : (
                companies.map((company, idx) => (
                  <TableRow key={company.CompanyId} className="hover:bg-secondary/50 transition-colors h-14">
                    <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 font-medium text-[14px]">{idx + 1}</TableCell>
                    <TableCell className="py-3 font-mono text-[14px] font-semibold text-[#111827] dark:text-gray-200">
                      COMP-{company.CompanyId.toString().padStart(5, '0')}
                    </TableCell>
                    <TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px]">
                      {company.CompanyName}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] max-w-[200px] truncate">
                      {company.ContactPerson || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px]">
                      {company.Phone || "—"}
                    </TableCell>
                    <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px] max-w-[200px] truncate">
                      {company.Address || "—"}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 text-[14px] font-medium">
                      {company.TotalProducts || 0}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <button
                        onClick={() => handleToggleStatus(company.CompanyId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          company.IsActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {company.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button onClick={() => openViewDialog(company)} className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(company)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => openDeleteDialog(company)} className="hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
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
              <select
                className="h-8 rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{(currentItem as Company).CompanyId ? "Edit Company" : "Add New Company"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Company Name <span className="text-rose-500">*</span></label>
              <Input
                value={(currentItem as Company).CompanyName || ""}
                onChange={e => setCurrentItem(prev => ({...prev, CompanyName: e.target.value}))}
                placeholder="e.g. Getz Pharma"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Contact Person</label>
              <Input
                value={(currentItem as Company).ContactPerson || ""}
                onChange={e => setCurrentItem(prev => ({...prev, ContactPerson: e.target.value}))}
                placeholder="e.g. John Doe (Medical Rep)"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Phone Number</label>
              <Input
                value={(currentItem as Company).Phone || ""}
                onChange={e => setCurrentItem(prev => ({...prev, Phone: e.target.value}))}
                placeholder="e.g. +92 300 1234567"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Address / City</label>
              <textarea
                value={(currentItem as Company).Address || ""}
                onChange={e => setCurrentItem(prev => ({...prev, Address: e.target.value}))}
                placeholder="Optional company address or city..."
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Status</label>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    (currentItem as Company).IsActive ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-sm font-semibold",
                    (currentItem as Company).IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  )}>
                    {(currentItem as Company).IsActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(currentItem as Company).IsActive ? "Company is visible and usable" : "Company is hidden from use"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={(currentItem as Company).IsActive}
                  onClick={() => setCurrentItem(prev => ({...prev, IsActive: !(prev as Company).IsActive}))}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30",
                    (currentItem as Company).IsActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                      (currentItem as Company).IsActive ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Company Code</p>
              <p className="font-mono text-lg font-semibold">
                COMP-{(currentItem as Company).CompanyId?.toString().padStart(5, '0')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Company Name</p>
              <p className="text-lg font-medium">{(currentItem as Company).CompanyName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="flex items-center">
                <span className={cn(
                  "px-3 py-1 text-[13px] font-bold rounded-full",
                  (currentItem as Company).IsActive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                )}>
                  {(currentItem as Company).IsActive ? "Active" : "Inactive"}
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
            <p>Are you absolutely sure you want to delete the company <strong>{(itemToDelete as Company)?.CompanyName}</strong>?</p>
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