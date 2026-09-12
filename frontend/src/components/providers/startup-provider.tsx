"use client";
import { getAccessToken, resolveApiBaseUrl } from "@/lib/api-client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetAuthState } from "@/lib/auth-session";

export function StartupProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 1: Wait for backend to fully start and resolve its port
        const baseUrl = await resolveApiBaseUrl();
        console.info("[PMS production trace] startup API resolved", { baseUrl, pathname });
        
        // Step 2: Check License
        // VERY IMPORTANT: Prevent WebView2 from caching this GET request across restarts.
        const licenseRes = await fetch(`${baseUrl}/license/status`, { cache: "no-store" });
        if (!licenseRes.ok) throw new Error("License server error");
        
        const licenseData = await licenseRes.json();
        console.info("[PMS production trace] license status", { status: licenseData.status, pathname });
        
        if (licenseData.status !== "Active") {
          // If not active, enforce activation unless they are on the login page or activation page
          if (pathname !== "/activate" && pathname !== "/") {
            console.info("[PMS production trace] redirect", { from: pathname, to: "/activate", reason: "license-not-active" });
            router.push("/activate");
          }
          setIsReady(true);
          return;
        }

        // License is active. 
        // Step 2: Check Session
        const token = getAccessToken();
        
        if (!token) {
          // No session found, send to login
          if (pathname !== "/" && pathname !== "/activate") {
            console.info("[PMS production trace] redirect", { from: pathname, to: "/", reason: "missing-session" });
            router.push("/");
          }
          setIsReady(true);
          return;
        }

        // Verify token validity
        const authRes = await fetch(`${baseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (authRes.ok) {
          // Valid token! Go to dashboard if we are on login screen
          if (pathname === "/" || pathname === "/activate") {
            try {
              const authData = await authRes.json();
              if (authData.role === "cashier") {
                router.push("/dashboard/sales");
                return;
              }
              // Fetch SystemPreferences for StartupModule redirection
              const prefRes = await fetch(`${baseUrl}/settings/appearance`);
              if (prefRes.ok) {
                const pref = await prefRes.json();
                if (pref.StartupModule === "POS Terminal") {
                  router.push("/dashboard/sales");
                } else if (pref.StartupModule === "Inventory") {
                  router.push("/dashboard/inventory");
                } else {
                  router.push("/dashboard");
                }
              } else {
                router.push("/dashboard");
              }
            } catch {
              router.push("/dashboard");
            }
          }
        } else {
          // Invalid token, clear stored session and reset any stale auth state
          resetAuthState();
          if (pathname !== "/") {
            router.push("/");
          }
        }
      } catch (err) {
        console.error("Startup checks failed:", err);
        // Never eject the user from activation because of a transient sidecar
        // readiness error; the activation screen displays its own retryable error.
        if (pathname !== "/" && pathname !== "/activate") {
          console.info("[PMS production trace] redirect", { from: pathname, to: "/", reason: "startup-check-failed" });
          router.push("/");
        }
      } finally {
        setIsReady(true);
      }
    };

    initializeApp();
    // Startup verification belongs to the process boot path. Re-running the
    // license and session requests on every client-side route made navigation
    // wait on unrelated security/file-system work.
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
