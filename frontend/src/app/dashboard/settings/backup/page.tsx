"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect old /dashboard/settings/backup route to the standalone
 * /dashboard/backup module. Backup & Restore is now a first-class
 * sidebar module and is no longer nested under Settings.
 */
export default function BackupSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/backup");
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
      Redirecting to Backup &amp; Restore…
    </div>
  );
}
