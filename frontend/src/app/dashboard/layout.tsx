import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { InventorySettingsProvider } from "@/contexts/InventorySettingsContext";
import { AutoLockWrapper } from "@/components/layout/auto-lock-wrapper";
import { SessionTimeoutWrapper } from "@/components/layout/session-timeout-wrapper";
import { LicenseExpiryBar } from "@/components/layout/license-expiry-bar";
import { ExitBackupMounter } from "@/components/layout/exit-backup-mounter";
import { AccessGuard } from "@/components/layout/access-guard";
import { AuthGate } from "@/components/layout/auth-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionTimeoutWrapper>
      <AutoLockWrapper>
        <AuthGate>
          <ExitBackupMounter />
          <div className="flex h-screen w-full bg-background overflow-hidden print:h-auto print:overflow-visible print:bg-white">
            <div className="print:hidden shrink-0">
              <Sidebar />
            </div>
            <div className="flex flex-col flex-1 min-w-0 print:block">
              <div className="print:hidden">
                <Header />
              </div>
              <LicenseExpiryBar />
              <main className="flex-1 overflow-y-auto print:overflow-visible">
                <InventorySettingsProvider>
                  <AccessGuard>
                    {children}
                  </AccessGuard>
                </InventorySettingsProvider>
              </main>
            </div>
          </div>
        </AuthGate>
      </AutoLockWrapper>
    </SessionTimeoutWrapper>
  );
}
