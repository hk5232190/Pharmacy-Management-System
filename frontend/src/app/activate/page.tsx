"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Key, Copy, CheckCircle2, ArrowRight, Upload, FileText, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ActivatePage() {
  const [hwid, setHwid] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [licenseData, setLicenseData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024, dm = 2, sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  useEffect(() => {
    // Fetch HWID on mount
    fetch("http://127.0.0.1:8000/api/v1/license/hwid")
      .then((res) => res.json())
      .then((data) => setHwid(data.hwid))
      .catch(() => setError("Failed to fetch Hardware ID from backend. Is the server running?"));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(hwid);
    alert("Hardware ID copied to clipboard!");
  };

  const handleActivate = async () => {
    if (!selectedFile) {
      setError("Please select a .lic file");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://127.0.0.1:8000/api/v1/license/activate", {
        method: "POST",
        body: formData,
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
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans p-4 relative overflow-hidden">
      
      {/* Decorative Blobs */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl rounded-full mix-blend-multiply dark:mix-blend-lighten animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-violet-500/10 dark:bg-violet-500/5 blur-3xl rounded-full mix-blend-multiply dark:mix-blend-lighten animate-pulse delay-700" />
      
      <Card className="w-full max-w-[500px] p-8 sm:p-10 shadow-2xl shadow-indigo-500/10 dark:shadow-none ring-1 ring-slate-200/60 dark:ring-slate-800 rounded-3xl bg-white/90 dark:bg-card/90 backdrop-blur-xl text-card-foreground relative z-10 overflow-hidden">
        
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5 transition-colors duration-500 ${success ? 'bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/20' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-4 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.2)]'}`}>
            {success ? <CheckCircle2 size={32} /> : <Shield size={32} />}
          </div>
          <h2 className="text-[28px] font-extrabold mb-2 tracking-tight">
            {success ? (
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400">License Activated</span>
            ) : (
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Activate License</span>
            )}
          </h2>
          <p className="text-muted-foreground font-medium">
            {success 
              ? "Your software is now fully activated and ready to use." 
              : "Upload your valid license file to unlock the software."}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[13px] font-medium p-4 rounded-xl ring-1 ring-rose-200 dark:ring-rose-800 flex items-center mb-6 animate-in slide-in-from-top-2 duration-300">
            {error}
          </div>
        )}

        {!success ? (
          <div className="space-y-6">
            {/* HWID Section */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground flex justify-between items-center">
                Your Hardware ID
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary px-2 py-0.5 rounded-full">Required</span>
              </label>
              <div className="flex gap-2 group">
                <div className="flex-1 bg-secondary/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-[13px] font-mono text-slate-700 dark:text-slate-300 truncate shadow-inner">
                  {hwid || "Loading..."}
                </div>
                <Button variant="outline" onClick={handleCopy} className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 h-auto px-4 rounded-xl transition-all">
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            {/* License File Dropzone */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground flex justify-between items-center">
                License File (.lic)
                <span className="text-[11px] font-medium text-muted-foreground">Upload activation file</span>
              </label>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".lic" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!file.name.endsWith(".lic")) {
                      setError("Only .lic files are accepted.");
                      return;
                    }
                    setSelectedFile(file);
                    setError("");
                  }
                }}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    if (!file.name.endsWith(".lic")) {
                      setError("Only .lic files are accepted.");
                      return;
                    }
                    setSelectedFile(file);
                    setError("");
                  }
                }}
                onClick={() => {
                  if (!selectedFile) fileInputRef.current?.click();
                }}
                className={`border-2 rounded-2xl p-7 text-center transition-all duration-300 relative ${
                  dragOver
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 scale-[1.02] border-solid ring-4 ring-indigo-500/10"
                    : selectedFile
                      ? "border-indigo-400/50 bg-indigo-50/30 dark:bg-indigo-950/20 border-solid"
                      : "border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400/50 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                }`}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center justify-center gap-3 relative z-10 animate-in zoom-in-95 duration-200">
                    <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-3.5 rounded-2xl shadow-sm">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{selectedFile.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 font-medium">{formatBytes(selectedFile.size)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="absolute -top-3 -right-3 p-1.5 rounded-full bg-white dark:bg-slate-800 shadow-md ring-1 ring-slate-200 dark:ring-slate-700 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-all"
                      title="Remove file"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 pointer-events-none">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                      dragOver ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                    }`}>
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                        {dragOver ? "Release to upload" : "Drag & drop your .lic file"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">or click to browse</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={handleActivate}
              disabled={isLoading || !hwid || !selectedFile}
              className="w-full h-[54px] text-[15px] font-bold mt-6 shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
            >
              {isLoading ? "Verifying..." : "Activate Software"} <Key className="ml-2" size={18} />
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            {/* License Details - Success Card */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl p-6 ring-1 ring-slate-200/60 dark:ring-slate-800 shadow-inner space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[13px] text-muted-foreground font-semibold">Status</span>
                <span className="bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Active</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground font-semibold">Client Name</span>
                <span className="text-[14px] font-bold text-foreground">{licenseData?.client_name || "N/A"}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground font-semibold">License Type</span>
                <span className="text-[14px] font-bold text-indigo-600 dark:text-indigo-400 capitalize">{licenseData?.license_type || "N/A"}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[13px] text-muted-foreground font-semibold">Valid Until</span>
                <span className="text-[14px] font-extrabold text-slate-800 dark:text-slate-200">{licenseData?.expiry_date ? new Date(licenseData.expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "Lifetime"}</span>
              </div>
            </div>

            <Button 
              onClick={() => router.push("/")}
              className="w-full h-[54px] text-[15px] font-bold shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-0"
            >
              Continue to Dashboard <ArrowRight className="ml-2" size={18} />
            </Button>
          </div>
        )}

      </Card>
    </div>
  );
}
