"use client";

import { useState, useEffect } from "react";
import {
  Code2, Monitor, HardDrive, Cpu, MemoryStick, Database,
  Globe, Mail, Phone, Shield, ShieldCheck,
  Calendar, Tag, Building2, Copyright, RefreshCw,
  Loader2, ExternalLink, Server, Clock, Layers,
  Info, HeartHandshake, Infinity, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AboutData {
  app: {
    software_name: string;
    software_short: string;
    version: string;
    build_number: string;
    release_date: string;
    edition: string;
    framework: string;
    database_engine: string;
  };
  developer: {
    company_name: string;
    developer: string;
    website: string;
    email: string;
    country: string;
    copyright_year: string;
    copyright: string;
    license_type_text: string;
  };
  support: {
    support_email: string;
    phone: string;
    whatsapp: string;
  };
  system: {
    os_name: string;
    os_version: string;
    architecture: string;
    cpu: string;
    ram_total: string;
    python_version: string;
    disk: {
      total: string;
      used: string;
      free: string;
      used_percent: number;
    };
    database: {
      path: string;
      size_bytes: number;
      size_human: string;
    };
    server_uptime: string;
    backend_port: number;
    frontend_port: number;
  };
  license: {
    status: string;
    type?: string;
    expiry_date?: string;
    remaining_days?: number | null;
    is_lifetime?: boolean;
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children, className }: {
  icon: any; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl bg-white dark:bg-card", className)}>
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent flex items-center gap-3">
        <Icon size={20} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
        <h3 className="font-bold text-xl text-indigo-700 dark:text-indigo-400">{title}</h3>
      </div>
      <div className="p-7 space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false, href }: {
  label: string; value?: string | null; mono?: boolean; href?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 gap-4">
      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium shrink-0">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 text-right">
          {value} <ExternalLink size={14} />
        </a>
      ) : (
        <span className={cn("text-sm font-semibold text-slate-900 dark:text-slate-100 text-right break-all", mono && "font-mono")}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

function StatPill({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: any; color: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3.5 flex items-center gap-3", color)}>
      <Icon size={18} className="shrink-0" />
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function DiskBar({ used, total, percent }: { used: string; total: string; percent: number }) {
  const color = percent > 85 ? "bg-rose-500" : percent > 65 ? "bg-orange-500" : "bg-emerald-500";
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground font-medium">
        <span>Used: {used}</span>
        <span>Total: {total}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-right text-muted-foreground">{percent}% used</p>
    </div>
  );
}

function LicenseStatusBadge({ status, type, expiryDate, remainingDays, isLifetime }: {
  status: string; type?: string; expiryDate?: string; remainingDays?: number | null; isLifetime?: boolean;
}) {
  const isActive = status === "Active";
  return (
    <div className={cn(
      "rounded-xl border p-4 flex items-center gap-4",
      isActive
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
        : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        isActive ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-rose-100 dark:bg-rose-900/40")}>
        <ShieldCheck size={20} className={isActive ? "text-emerald-600" : "text-rose-600"} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", isActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
            {status}
          </span>
          {type && (
            <span className="text-xs bg-secondary border border-border rounded-full px-2 py-0.5 font-medium text-muted-foreground">
              {type}
            </span>
          )}
        </div>
        {isActive && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLifetime ? "Lifetime License – Never Expires" : `Expires: ${expiryDate} (${remainingDays} days remaining)`}
          </p>
        )}
      </div>
      {isActive && isLifetime && <Infinity size={22} className="text-primary shrink-0" />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [data, setData] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => { fetchAbout(); }, []);

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/about/check-updates");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUpdateStatus(data.message || (data.status === "up_to_date" ? "You are up to date" : "Update Available"));
    } catch {
      toast.error("Failed to check for updates.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const fetchAbout = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/about/info");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      toast.error("Failed to load about information.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading system information...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { app, developer, support, system, license } = data;

  return (
    <div className="w-full flex-1 space-y-6 pb-20 pr-24 lg:pr-32">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">About Software</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Application details, system information, and support resources.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAbout} className="gap-2 shrink-0">
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-secondary/30 p-8 flex items-center justify-between gap-6 flex-wrap">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-center gap-6">
          {/* App Icon */}
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <Package size={36} className="text-primary-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-foreground">{app.software_name}</h1>
              <span className="bg-primary/10 text-primary border border-primary/20 text-sm font-bold px-3 py-1 rounded-full">
                {app.edition}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-medium">{app.framework}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Tag size={15} />
                <span className="font-semibold text-foreground">V {app.version}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Code2 size={15} />
                <span>Build {app.build_number}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar size={15} />
                <span>Released {app.release_date}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Database size={15} />
                <span>{app.database_engine}</span>
              </div>
              <button
                onClick={() => {
                  const specs = `${app.software_short} Pro v${app.version} | Build ${app.build_number} | ${app.database_engine}`;
                  navigator.clipboard.writeText(specs);
                  toast.success("System specs copied to clipboard");
                }}
                className="ml-2 flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors"
                title="Copy Specs"
              >
                <Copy size={12} /> Copy Specs
              </button>
            </div>
          </div>
        </div>
        
        <div className="relative shrink-0 text-right flex flex-col items-end gap-2">
          <Button onClick={handleCheckUpdates} disabled={checkingUpdates} variant="outline" className="gap-2 bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary/5">
            {checkingUpdates ? <Loader2 size={16} className="animate-spin text-primary" /> : <RefreshCw size={16} className="text-primary" />}
            Check for Updates
          </Button>
          {updateStatus && (
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 animate-in fade-in zoom-in duration-300">
              {updateStatus}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Software Information ── */}
        <SectionCard icon={Info} title="Application Information">
          <InfoRow label="Software Name"   value={app.software_name} />
          <InfoRow label="Short Name"      value={app.software_short} />
          <InfoRow label="Version"         value={`V ${app.version}`} />
          <InfoRow label="Build Number"    value={app.build_number} mono />
          <InfoRow label="Release Date"    value={app.release_date} />
          <InfoRow label="Edition"         value={app.edition} />
          <InfoRow label="Framework"       value={app.framework} />
          <InfoRow label="Database Engine" value={app.database_engine} />
        </SectionCard>

        {/* ── Developer / Company ── */}
        <SectionCard icon={Building2} title="Developer & Company Information">
          <InfoRow label="Company"    value={developer.company_name} />
          <InfoRow label="Developer"  value={developer.developer} />
          <InfoRow label="Country"    value={developer.country} />
          <InfoRow label="Website"    value={developer.website.replace(/^https?:\/\//, '')} href={developer.website} />
          <InfoRow label="Email"      value={developer.email} href={`mailto:${developer.email}`} />
          <InfoRow label="WhatsApp Support" value={support.whatsapp} href={`https://wa.me/${support.whatsapp.replace(/[^0-9]/g, '')}`} />
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Copyright size={13} className="mt-0.5 shrink-0" />
              <span className="font-medium">© {new Date().getFullYear()} {developer.company_name}. All rights reserved.</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 ml-5">{developer.license_type_text}</p>
          </div>
        </SectionCard>
      </div>

      {/* ── System Information ── */}
      <SectionCard icon={Monitor} title="System Information">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatPill
            icon={Monitor}
            label="Operating System"
            value={system.os_name}
            color="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
          />
          <StatPill
            icon={Cpu}
            label="Architecture"
            value={system.architecture}
            color="bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400"
          />
          <StatPill
            icon={MemoryStick}
            label="Total RAM"
            value={system.ram_total}
            color="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
          />
          <StatPill
            icon={Clock}
            label="Server Uptime"
            value={system.server_uptime}
            color="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="CPU" value={system.cpu} />
            <InfoRow label="Python Version" value={system.python_version} mono />
            <InfoRow label="Backend Port" value={`:${system.backend_port}`} mono />
            <InfoRow label="Frontend Port" value={`:${system.frontend_port}`} mono />
          </div>
          <div>
            <InfoRow label="OS Version" value={system.os_version} mono />
            <InfoRow label="Database File" value={system.database.path} mono />
            <InfoRow label="Database Size" value={system.database.size_human} />
            <div className="py-2.5 border-b border-border/60 last:border-0">
              <p className="text-xs text-muted-foreground font-medium mb-2">Disk Usage</p>
              <DiskBar
                used={system.disk.used}
                total={system.disk.total}
                percent={system.disk.used_percent}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── License Info (Display Only) ── */}
      <SectionCard icon={Shield} title="License Information (Display Only)">
        <LicenseStatusBadge
          status={license.status}
          type={license.type}
          expiryDate={license.expiry_date}
          remainingDays={license.remaining_days}
          isLifetime={license.is_lifetime}
        />
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Info size={12} />
          To manage your license, go to{" "}
          <a href="/dashboard/settings/license" className="text-primary font-semibold hover:underline">
            Settings → License Information
          </a>
        </p>
      </SectionCard>

      {/* ── Footer ── */}
      <div className="text-center py-4 space-y-1">
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">
            PMS V {app.version} · Build {app.build_number} · Running on port {system.backend_port}
          </span>
        </div>
      </div>

    </div>
  );
}

