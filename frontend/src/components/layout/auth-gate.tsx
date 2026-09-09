"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="bg-primary/10 p-4 rounded-full">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Verifying Session...</h2>
          <p className="text-sm font-medium text-slate-500">Loading your permissions</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}