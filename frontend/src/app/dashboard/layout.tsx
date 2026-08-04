import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        
        {/* Main Footer (Status Bar) */}
        <footer className="h-10 border-t border-border bg-card flex items-center justify-between px-6 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>System Status: <span className="text-green-600 dark:text-green-500 font-medium">Healthy</span></span>
          </div>
          <div className="flex items-center gap-6">
            <span>Backup: Today, 02:30 AM</span>
            <div className="w-[1px] h-3 bg-border"></div>
            <span>Version 1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
