"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function StartupProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 1: Check License
        const licenseRes = await fetch("http://127.0.0.1:8000/api/v1/license/status");
        if (!licenseRes.ok) throw new Error("License server error");
        
        const licenseData = await licenseRes.json();
        
        if (licenseData.status !== "Active") {
          // If not active, redirect to activate, unless we are already there
          if (pathname !== "/activate") {
            router.push("/activate");
          }
          setIsReady(true);
          return;
        }

        // License is active. 
        // Step 2: Check Session
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        
        if (!token) {
          // No session found, send to login
          if (pathname !== "/" && pathname !== "/activate") {
            router.push("/");
          }
          setIsReady(true);
          return;
        }

        // Verify token validity
        const authRes = await fetch("http://127.0.0.1:8000/api/v1/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (authRes.ok) {
          // Valid token! Go to dashboard if we are on login screen
          if (pathname === "/" || pathname === "/activate") {
            router.push("/dashboard");
          }
        } else {
          // Invalid token, remove it
          localStorage.removeItem("access_token");
          sessionStorage.removeItem("access_token");
          if (pathname !== "/") {
            router.push("/");
          }
        }
      } catch (err) {
        console.error("Startup checks failed:", err);
        // Fallback to login if backend isn't ready
        if (pathname !== "/") {
          router.push("/");
        }
      } finally {
        // Add a tiny delay to ensure smooth transition without flickering
        setTimeout(() => setIsReady(true), 300);
      }
    };

    initializeApp();
  }, [pathname, router]);

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
