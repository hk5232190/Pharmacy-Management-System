"use client";
import { getApiBaseUrl } from "@/lib/api-client";

import { useState, useEffect } from "react";
import {
  Code2, Monitor, HardDrive, Cpu, MemoryStick, Database,
  Globe, Mail, Phone, Shield, ShieldCheck, ShieldAlert, ShieldX,
  Calendar, Tag, Building2, Copyright, RefreshCw,
  Loader2, ExternalLink, Server, Clock, Layers,
  Info, HeartHandshake, Infinity, Package, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

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

function SectionCard({ icon: Icon, title, children, className, action }: {
  icon: any; title: string; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={cn("border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl bg-white dark:bg-card", className)}>
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon size={20} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
          <h3 className="font-bold text-xl text-indigo-700 dark:text-indigo-400">{title}</h3>
        </div>
        {action && <div>{action}</div>}
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
        <a href={href} 
          onClick={async (e) => {
            e.preventDefault();
            if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
              try {
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(href);
              } catch (err) {
                console.error("Failed to open link", err);
                window.open(href, '_blank', 'noopener,noreferrer');
              }
            } else {
              window.open(href, '_blank', 'noopener,noreferrer');
            }
          }}
          className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 text-right cursor-pointer">
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
  let tier = "invalid";
  if (status === "Active") {
    if (isLifetime || (remainingDays != null && remainingDays > 14)) tier = "active";
    else if (remainingDays != null && remainingDays <= 14) tier = "warning";
  }

  const styles = {
    active: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-800",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: "text-emerald-600",
      IconElement: ShieldCheck
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      text: "text-amber-700 dark:text-amber-400",
      icon: "text-amber-600",
      IconElement: ShieldAlert
    },
    invalid: {
      bg: "bg-rose-50 dark:bg-rose-950/20",
      border: "border-rose-200 dark:border-rose-800",
      iconBg: "bg-rose-100 dark:bg-rose-900/40",
      text: "text-rose-700 dark:text-rose-400",
      icon: "text-rose-600",
      IconElement: ShieldX
    }
  };

  const activeStyle = styles[tier as keyof typeof styles];
  const IconCmp = activeStyle.IconElement;

  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-4", activeStyle.bg, activeStyle.border)}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", activeStyle.iconBg)}>
        <IconCmp size={20} className={activeStyle.icon} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", activeStyle.text)}>
            {status}
          </span>
          {type && (
            <span className="text-xs bg-secondary border border-border rounded-full px-2 py-0.5 font-medium text-muted-foreground">
              {type}
            </span>
          )}
        </div>
        {status === "Active" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLifetime ? "Lifetime License – Never Expires" : `Expires: ${new Date(expiryDate as string).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} (${remainingDays} days remaining)`}
          </p>
        )}
      </div>
      {status === "Active" && isLifetime && <Infinity size={22} className="text-primary shrink-0" />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [data, setData] = useState<AboutData | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAbout(); }, []);

  const fetchAbout = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || ""}` };
      const [resAbout, resDiag, resLic] = await Promise.all([
        fetch(`${getApiBaseUrl()}/about/info`, { headers }),
        fetch(`${getApiBaseUrl()}/system/diagnostics`, { headers }).catch(() => null),
        fetch(`${getApiBaseUrl()}/license/info`, { headers }).catch(() => null)
      ]);
      
      if (!resAbout.ok) throw new Error("Failed");
      const aboutData = await resAbout.json();
      
      if (resLic && resLic.ok) {
        const licData = await resLic.json();
        aboutData.license = {
          status: licData.status,
          type: licData.license_type,
          expiry_date: licData.expiry_date,
          remaining_days: licData.remaining_days,
          is_lifetime: licData.total_days === null,
        };
      }
      setData(aboutData);
      
      if (resDiag && resDiag.ok) {
        setDiagnostics(await resDiag.json());
      }
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
                <span>Released {new Date(app.release_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Database size={15} />
                <span>{app.database_engine}</span>
              </div>

            </div>
          </div>
        </div>
        

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Software Information ── */}
        <SectionCard icon={Info} title="Application Information">
          <InfoRow label="Software Name"   value={app.software_name} />
          <InfoRow label="Short Name"      value={app.software_short} />
          <InfoRow label="Version"         value={`V ${app.version}`} />
          <InfoRow label="Build Number"    value={app.build_number} mono />
          <InfoRow label="Release Date"    value={new Date(app.release_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
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
          <Link href="/dashboard/settings/license" className="text-primary font-semibold hover:underline">
            Settings → License Information
          </Link>
        </p>
      </SectionCard>

      {/* ── Footer ── */}
      <div className="text-center py-4 space-y-1">
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">
            PMS V {app.version} · Build {app.build_number}
          </span>
        </div>
      </div>

    </div>
  );
}

