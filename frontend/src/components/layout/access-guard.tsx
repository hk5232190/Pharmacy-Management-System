"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { TrendingUp, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_PREFIXES = ["/dashboard/sales"];

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // Default user has role "admin", so non-cashiers always see the app.
  const isCashier = user.role === "cashier";

  useEffect(() => {
    // Cashiers should never idle on the plain dashboard landing page.
    if (isCashier && pathname === "/dashboard") {
      router.replace("/dashboard/sales");
    }
  }, [isCashier, pathname, router]);

  if (!isCashier) return <>{children}</>;

  if (ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8">
      <div className="bg-red-500/10 p-4 rounded-full">
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-foreground">Access Denied</h2>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        Your cashier account is limited to the Sales & POS Billing module.
      </p>
      <button
        onClick={() => router.push("/dashboard/sales")}
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