"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users as UsersIcon,
  UserPlus,
  ShieldCheck,
  UserCog,
  Edit,
  Loader2,
  RefreshCcw,
  Search,
  Check,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const API = "http://127.0.0.1:8000/api/v1";

function getToken() {
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
}

function authHeaders() {
  return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

interface UserRecord {
  UserId: number;
  Username: string;
  FullName: string | null;
  Email: string | null;
  PhoneNumber: string | null;
  ProfilePhotoPath: string | null;
  IsActive: boolean;
  Role: string;
  CreatedAt: string | null;
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold",
        isAdmin
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      )}
    >
      {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
      {isAdmin ? "Admin" : "Cashier"}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold",
        isActive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
      )}
    >
      {isActive ? <Check className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create / Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    password: "",
    role: "cashier",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/users`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      } else {
        toast.error("Failed to load users.");
      }
    } catch {
      toast.error("Network error while loading users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const adminCount = useMemo(
    () => users.filter(u => u.Role === "admin" && u.IsActive).length,
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.Username.toLowerCase().includes(q) ||
      (u.FullName || "").toLowerCase().includes(q) ||
      u.Role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ username: "", full_name: "", password: "", role: "cashier", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditingId(u.UserId);
    setForm({
      username: u.Username,
      full_name: u.FullName || "",
      password: "",
      role: u.Role,
      is_active: u.IsActive,
    });
    setDialogOpen(true);
  };

  // Mirror of the backend self-service + last-admin guards for the edit form
  const isSelf = editingId !== null && editingId === currentUser.id;
  const edited = editingId !== null ? users.find(u => u.UserId === editingId) : undefined;
  const isProtectedLastAdmin =
    !!edited &&
    edited.Role === "admin" &&
    edited.IsActive &&
    adminCount <= 1;

  const handleSave = async () => {
    const username = form.username.trim();
    if (editingId === null) {
      if (username.length < 3) { toast.error("Username must be at least 3 characters."); return; }
      if (form.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    }
    if (form.role !== "admin" && form.role !== "cashier") { toast.error("Role must be 'admin' or 'cashier'."); return; }
    if (form.password && form.password.length < 6) { toast.error("New password must be at least 6 characters."); return; }
    if (search) setSearch("");

    setSaving(true);
    try {
      let res: Response;
      if (editingId === null) {
        res = await fetch(`${API}/users`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            username,
            full_name: form.full_name.trim() || null,
            password: form.password,
            role: form.role,
          }),
        });
      } else {
        const payload: Record<string, unknown> = { full_name: form.full_name.trim() || null };
        if (!isSelf && form.role !== edited?.Role) payload.role = form.role;
        if (!isSelf && !isProtectedLastAdmin && form.is_active !== edited?.IsActive) payload.is_active = form.is_active;
        if (form.password) payload.password = form.password;
        res = await fetch(`${API}/users/${editingId}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(editingId === null ? "User created successfully." : "User updated successfully.");
        setDialogOpen(false);
        fetchUsers();
      } else {
        toast.error(data.detail || (data.error) || "Operation failed.");
      }
    } catch {
      toast.error("Network error during save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage application accounts. Admins get full access; cashiers are limited to Sales &amp; POS Billing.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
          <UserPlus className="mr-2 h-4 w-4" /> Add New User
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b px-5 py-4 space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-blue-600" /> User Accounts
            </CardTitle>
            <div className="flex-1" />
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, name or role..."
                className="pl-9 h-10 w-full bg-background border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 bg-background text-foreground" onClick={fetchUsers} disabled={loading}>
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-0 custom-scrollbar">
          <div className="border-b border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-10 text-center">#</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Username</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-1/4">Full Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32">Role</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 w-36">Created</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right pr-6 w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No users found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u, idx) => (
                    <TableRow key={u.UserId} className="hover:bg-secondary/50 transition-colors h-14">
                      <TableCell className="text-center py-3 text-[#111827] dark:text-gray-200 font-medium text-[14px]">{idx + 1}</TableCell>
                      <TableCell className="py-3 font-semibold text-[#111827] dark:text-white text-[14px]">
                        <span className="flex items-center gap-2">
                          {u.Username}
                          {u.UserId === currentUser.id && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full">You</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[14px]">{u.FullName || "—"}</TableCell>
                      <TableCell className="py-3"><RoleBadge role={u.Role} /></TableCell>
                      <TableCell className="text-center py-3"><StatusBadge isActive={u.IsActive} /></TableCell>
                      <TableCell className="py-3 text-[#111827] dark:text-gray-200 text-[13px]">
                        {u.CreatedAt ? new Date(u.CreatedAt).toLocaleDateString("en-GB") : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-3 text-muted-foreground">
                          <button onClick={() => openEdit(u)} className="hover:text-blue-500 transition-colors" title="Edit user">
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Add New User" : `Edit User: ${form.username}`}</DialogTitle>
            <DialogDescription>
              {editingId === null
                ? "Cashiers get sales-only access. Admins can manage the entire system."
                : "Update account details, role, status, or reset the password."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="user-username">Username</Label>
              <Input
                id="user-username"
                value={form.username}
                disabled={editingId !== null}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="e.g. cashier01"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-fullname">Full Name</Label>
              <Input
                id="user-fullname"
                value={form.full_name}
                onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-password">{editingId === null ? "Password" : "New Password (optional)"}</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editingId === null ? "Min. 6 characters" : "Leave blank to keep current password"}
              />
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm(f => ({ ...f, role: v }))}
                disabled={isSelf || (editingId !== null && isProtectedLastAdmin)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-xs text-amber-600 dark:text-amber-400">You cannot change your own role.</p>
              )}
              {editingId !== null && isProtectedLastAdmin && (
                <p className="text-xs text-amber-600 dark:text-amber-400">This is the last active admin — its role cannot be changed.</p>
              )}
            </div>

            {editingId !== null && (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 gap-4">
                <div>
                  <p className="text-sm font-medium">Active Account</p>
                  <p className="text-xs text-muted-foreground">
                    {isSelf
                      ? "You cannot deactivate your own account."
                      : isProtectedLastAdmin
                        ? "Cannot deactivate the last active admin."
                        : "Disable login access for this account."}
                  </p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
                  disabled={isSelf || isProtectedLastAdmin}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : editingId === null ? "Create User" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}