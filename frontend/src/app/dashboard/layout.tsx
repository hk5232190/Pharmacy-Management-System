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
        <footer className="h-10 border-t border-border bg-card flex items-center px-6 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary px-2.5 py-1 rounded-md font-semibold border border-primary/20 shadow-sm">
              Version 1.0.0
            </div>
            <div className="w-[1px] h-4 bg-border"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
              <span>System Status: <span className="text-green-600 dark:text-green-500 font-medium">Healthy</span></span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
