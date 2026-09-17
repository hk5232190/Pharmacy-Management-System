"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { TrendingUp, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Maps each module permission key to the route prefix(es) it protects.
 * A cashier with a given module key can access any path starting with the listed prefix(es).
 */
const MODULE_ROUTES: Record<string, string[]> = {
  sales:      ["/dashboard/sales"],
  // The root /dashboard is the Dashboard landing page — guard it with the dashboard key.
  // /dashboard/notifications is a sub-page that also belongs to the dashboard module.
  dashboard:  ["/dashboard/notifications"],
  purchases:  ["/dashboard/purchases"],
  inventory:  ["/dashboard/inventory"],
  medicines:  ["/dashboard/masters/medicines", "/dashboard/masters/categories", "/dashboard/masters/companies"],
  suppliers:  ["/dashboard/masters/suppliers"],
  customers:  ["/dashboard/masters/customers"],
  reports:    ["/dashboard/reports"],
  // Settings: cashiers may only access these 4 sub-routes.
  // Admin-only sub-routes (general, profile, billing, printer, inventory, security, users)
  // are NOT listed — cashiers typing those URLs directly get Access Denied.
  settings:   [
    "/dashboard/settings/my-profile",
    "/dashboard/settings/backup-restore",
    "/dashboard/settings/license",
    "/dashboard/settings/about",
  ],
};

/** Module display names for the "Access Denied" screen. */
const MODULE_LABELS: Record<string, string> = {
  sales:      "Sales & POS Billing",
  dashboard:  "Dashboard",
  purchases:  "Purchases",
  inventory:  "Inventory",
  medicines:  "Medicines",
  suppliers:  "Suppliers",
  customers:  "Customers",
  reports:    "Reports",
  settings:   "Settings",
};

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const isCashier = user.role === "cashier";

  // Redirect a cashier sitting at the bare /dashboard root:
  //   - if they have the dashboard permission → stay (render dashboard)
  //   - if they don't → send them to sales (their default)
  // Also redirect cashier from /dashboard/settings root → my-profile (first allowed tab).
  useEffect(() => {
    if (!isCashier) return;
    if (pathname === "/dashboard" && !hasPermission("dashboard")) {
      router.replace("/dashboard/sales");
    }
    if (pathname === "/dashboard/settings" && hasPermission("settings")) {
      router.replace("/dashboard/settings/my-profile");
    }
  }, [isCashier, pathname, hasPermission, router]);

  // Admins pass through unconditionally
  if (!isCashier) return <>{children}</>;

  // ── /dashboard root: handled by the redirect above; render while we wait ──
  if (pathname === "/dashboard") {
    // If permission is granted, render immediately.
    if (hasPermission("dashboard")) return <>{children}</>;
    // Permission denied — render nothing while the redirect fires.
    return null;
  }

  // ── All other paths: check against MODULE_ROUTES ─────────────────────────
  for (const [module, prefixes] of Object.entries(MODULE_ROUTES)) {
    if (prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
      if (hasPermission(module)) return <>{children}</>;
      // Path matched but permission not granted → show access denied
      return (
        <AccessDenied
          moduleName={MODULE_LABELS[module] || module}
          onBack={() => router.push("/dashboard/sales")}
        />
      );
    }
  }

  // Any unmatched path (admin-only sections not in the map) → deny
  return (
    <AccessDenied
      moduleName="this section"
      onBack={() => router.push("/dashboard/sales")}
    />
  );
}

function AccessDenied({ moduleName, onBack }: { moduleName: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8">
      <div className="bg-red-500/10 p-4 rounded-full">
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-foreground">Access Denied</h2>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        Your account does not have permission to access <strong>{moduleName}</strong>.
        Contact your admin to request access.
      </p>
      <button
        onClick={onBack}
        className={cn(
          "mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
          "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        )}
      >
        <TrendingUp className="w-4 h-4" /> Go to POS
      </button>
    </div>
  );
}