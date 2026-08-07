"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ReceiptText, Percent, Package, Settings as SettingsIcon, Paintbrush, ShieldCheck, Info } from "lucide-react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navigation = [
    { name: "Pharmacy Information", href: "/dashboard/settings/profile", icon: Building2, description: "Basic information about your pharmacy" },
    { name: "Invoice & Billing", href: "/dashboard/settings/billing", icon: ReceiptText, description: "Configure invoice, receipt and billing" },
    { name: "Tax Settings", href: "/dashboard/settings/tax", icon: Percent, description: "Configure tax and VAT settings" },
    { name: "Inventory Preferences", href: "/dashboard/settings/inventory", icon: Package, description: "Manage stock and inventory options" },
    { name: "Application Preferences", href: "/dashboard/settings/application", icon: SettingsIcon, description: "General application behavior" },
    { name: "Appearance", href: "/dashboard/settings/appearance", icon: Paintbrush, description: "Customize theme and appearance" },
    { name: "License Information", href: "/dashboard/settings/license", icon: ShieldCheck, description: "View and manage license details" },
    { name: "About Software", href: "/dashboard/settings/about", icon: Info, description: "Application and system information" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col p-6 pb-2 border-b">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure your pharmacy, personalize the application, and manage system preferences.</p>
        
        <div className="flex items-center space-x-2 text-sm text-slate-500 mt-4">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-slate-900 dark:text-white font-medium">Settings</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <aside className="w-80 border-r bg-white dark:bg-slate-950 overflow-y-auto hidden md:block">
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-start p-3 rounded-lg transition-all ${
                    isActive 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm" 
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <item.icon className={`w-5 h-5 mt-0.5 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
                  <div className="ml-3">
                    <p className={`text-sm font-semibold ${isActive ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
