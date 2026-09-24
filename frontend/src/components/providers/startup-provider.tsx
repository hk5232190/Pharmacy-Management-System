"use client";
import { getAccessToken, resolveApiBaseUrl } from "@/lib/api-client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetAuthState } from "@/lib/auth-session";

export function StartupProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [expectedPath, setExpectedPath] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Watch for pathname changes to complete redirects
  useEffect(() => {
    if (expectedPath && pathname === expectedPath) {
      setIsReady(true);
      setExpectedPath(null);
    }
  }, [pathname, expectedPath]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const baseUrl = await resolveApiBaseUrl();
        console.info("[PMS production trace] startup API resolved", { baseUrl, pathname });
        
        const licenseRes = await fetch(`${baseUrl}/license/status`, { cache: "no-store" }).catch(() => null);
        if (!licenseRes || !licenseRes.ok) {
          console.warn("Backend not ready yet. Retrying in 200ms...");
          setTimeout(initializeApp, 200);
          return;
        }
        
        const licenseData = await licenseRes.json();
        console.info("[PMS production trace] license status", { status: licenseData.status, pathname });
        
        if (licenseData.status !== "Active") {
          if (pathname !== "/activate") {
            console.info("[PMS production trace] redirect", { from: pathname, to: "/activate", reason: "license-not-active" });
            setExpectedPath("/activate");
            router.push("/activate");
          } else {
            setIsReady(true);
          }
          return;
        }

        const token = getAccessToken();
        if (!token) {
          if (pathname !== "/") {
            console.info("[PMS production trace] redirect", { from: pathname, to: "/", reason: "missing-session" });
            setExpectedPath("/");
            router.push("/");
          } else {
            setIsReady(true);
          }
          return;
        }

        // Fetch auth and appearance settings in parallel to speed up startup
        const [authRes, prefRes] = await Promise.all([
          fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${baseUrl}/settings/appearance`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
        ]);

        if (authRes.ok) {
          if (pathname === "/" || pathname === "/activate") {
            try {
              const authData = await authRes.json();
              let target = "/dashboard";
              if (authData.role === "cashier") {
                target = "/dashboard/sales";
              } else if (prefRes && prefRes.ok) {
                const pref = await prefRes.json();
                if (pref.StartupModule === "POS Terminal") target = "/dashboard/sales";
                else if (pref.StartupModule === "Inventory") target = "/dashboard/inventory";
              }
              setExpectedPath(target);
              router.push(target);
            } catch {
              setExpectedPath("/dashboard");
              router.push("/dashboard");
            }
          } else {
            setIsReady(true);
          }
        } else {
          resetAuthState();
          if (pathname !== "/") {
            setExpectedPath("/");
            router.push("/");
          } else {
            setIsReady(true);
          }
        }
      } catch (err) {
        console.error("Startup checks failed:", err);
        if (pathname !== "/" && pathname !== "/activate") {
          console.info("[PMS production trace] redirect", { from: pathname, to: "/", reason: "startup-check-failed" });
          setExpectedPath("/");
          router.push("/");
        } else {
          setIsReady(true);
        }
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isReady) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="bg-primary/10 p-4 rounded-full">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Initializing PMS...</h2>
          <p className="text-sm font-medium text-slate-500">Verifying security protocols</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
