"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Key, Copy, CheckCircle2, UploadCloud, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ActivatePage() {
  const [hwid, setHwid] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [licenseData, setLicenseData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch HWID on mount
    fetch("http://localhost:8000/api/v1/license/hwid")
      .then((res) => res.json())
      .then((data) => setHwid(data.hwid))
      .catch(() => setError("Failed to fetch Hardware ID from backend. Is the server running?"));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(hwid);
    alert("Hardware ID copied to clipboard!");
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("Please paste a license key");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:8000/api/v1/license/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ license_key: licenseKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Invalid license key");
      }

      setSuccess(true);
      setLicenseData(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background font-sans p-4">
      <Card className="w-full max-w-[500px] p-8 sm:p-10 shadow-lg border-0 rounded-[24px] bg-card text-card-foreground">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
            {success ? <CheckCircle2 size={32} /> : <Shield size={32} />}
          </div>
          <h2 className="text-[26px] font-bold text-foreground mb-2">
            {success ? "License Activated" : "Activate License"}
          </h2>
          <p className="text-muted-foreground font-medium">
            {success 
              ? "Your software is now fully activated and ready to use." 
              : "Paste your valid license key to unlock the software."}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-[13px] font-medium p-4 rounded-xl border border-destructive/20 flex items-center mb-6">
            {error}
          </div>
        )}

        {!success ? (
          <div className="space-y-6">
            {/* HWID Section */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground flex justify-between">
                Your Hardware ID (HWID)
                <span className="text-[11px] font-medium text-muted-foreground font-normal">Required for license generation</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-secondary/50 border border-border rounded-lg p-3 text-[13px] font-mono text-foreground truncate">
                  {hwid || "Loading..."}
                </div>
                <Button variant="outline" onClick={handleCopy} className="border-border text-foreground px-4">
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            {/* License Key Section */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground flex justify-between">
                License Key (JWT Text)
                <span className="text-[11px] font-medium text-muted-foreground font-normal">Paste your activation key</span>
              </label>
              <textarea
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Paste your generated license key here..."
                rows={4}
                className="w-full bg-secondary/50 border border-border rounded-xl p-4 text-[13px] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              />
            </div>

            <Button 
              onClick={handleActivate}
              disabled={isLoading || !hwid || !licenseKey.trim()}
              className="w-full h-[52px] text-[15px] font-bold mt-4 shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl bg-primary text-primary-foreground"
            >
              {isLoading ? "Validating..." : "Activate Now"} <Key className="ml-2" size={18} />
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* License Details */}
            <div className="bg-secondary/50 rounded-xl p-5 border border-border space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-[13px] text-muted-foreground font-medium">Status</span>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full tracking-wide">Active</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground font-medium">Client</span>
                <span className="text-[14px] font-bold text-foreground">{licenseData?.client_name || "N/A"}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground font-medium">Type</span>
                <span className="text-[14px] font-bold text-primary capitalize">{licenseData?.license_type || "N/A"}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground font-medium">Expiry</span>
                <span className="text-[14px] font-bold text-foreground">{licenseData?.expiry_date ? new Date(licenseData.expiry_date).toLocaleDateString() : "Lifetime"}</span>
              </div>
            </div>

            <Button 
              onClick={() => router.push("/")}
              className="w-full h-[52px] text-[15px] font-bold shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl bg-primary text-primary-foreground"
            >
              Continue to Login <ArrowRight className="ml-2" size={18} />
            </Button>
          </div>
        )}

      </Card>
    </div>
  );
}
