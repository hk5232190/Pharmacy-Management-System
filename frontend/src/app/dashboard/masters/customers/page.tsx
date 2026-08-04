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

interface Customer {
  CustomerId: number;
  Name: string;
  Phone?: string;
  LoyaltyPoints: number;
  IsActive: boolean;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>({ Name: "", Phone: "", LoyaltyPoints: 0, IsActive: true });
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const url = new URL("http://localhost:8000/api/v1/customers");
      if (search) url.searchParams.append("search", search);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      } else {
        toast.error("Failed to load customers");
      }
    } catch (error) {
      toast.error("Network error while loading customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/customers/${id}/status`, { method: "PUT" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCustomers(customers.map(c => c.CustomerId === id ? { ...c, IsActive: !c.IsActive } : c));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!currentCustomer.Name?.trim()) {
      toast.error("Customer name is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const isEditing = !!currentCustomer.CustomerId;
      const url = isEditing 
        ? `http://localhost:8000/api/v1/customers/${currentCustomer.CustomerId}`
        : `http://localhost:8000/api/v1/customers`;
      
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentCustomer)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchCustomers(); // Reload list
      } else {
        toast.error(data.error || "Failed to save customer");
      }
    } catch (error) {
      toast.error("Network error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const openNewDialog = () => {
    setCurrentCustomer({ Name: "", Phone: "", LoyaltyPoints: 0, IsActive: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/20">
        <div className="relative w-full sm:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search customers by name or phone..." 
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
          <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchCustomers}>
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
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Customer Name</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Loyalty Points</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading customers...</TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No customers found.</TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.CustomerId} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="text-center"><Checkbox /></TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">
                      CUST-{customer.CustomerId.toString().padStart(5, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {customer.Name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.Phone || "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        {customer.LoyaltyPoints} pts
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <button 
                        onClick={() => handleToggleStatus(customer.CustomerId)}
                        className={cn(
                          "px-3 py-1 text-[11px] font-bold rounded-full transition-colors",
                          customer.IsActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" 
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                        )}
                      >
                        {customer.IsActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <button className="hover:text-primary transition-colors"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEditDialog(customer)} className="hover:text-blue-500 transition-colors"><Edit className="h-4 w-4" /></button>
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
            <DialogTitle>{currentCustomer.CustomerId ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Customer Name</label>
              <Input 
                value={currentCustomer.Name || ""}
                onChange={e => setCurrentCustomer({...currentCustomer, Name: e.target.value})}
                placeholder="e.g. John Doe"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Phone Number <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <Input 
                value={currentCustomer.Phone || ""}
                onChange={e => setCurrentCustomer({...currentCustomer, Phone: e.target.value})}
                placeholder="e.g. +1 234 567 890"
                className="h-11"
              />
            </div>
            
            {/* Loyalty points can usually be viewed/edited by admin */}
            {currentCustomer.CustomerId && (
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-foreground">Loyalty Points</label>
                 <Input 
                   type="number"
                   value={currentCustomer.LoyaltyPoints}
                   onChange={e => setCurrentCustomer({...currentCustomer, LoyaltyPoints: parseInt(e.target.value) || 0})}
                   className="h-11"
                 />
               </div>
            )}

            {!currentCustomer.CustomerId && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox 
                  id="isActive" 
                  checked={currentCustomer.IsActive} 
                  onCheckedChange={(c) => setCurrentCustomer({...currentCustomer, IsActive: c as boolean})}
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
              {isSaving ? "Saving..." : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
