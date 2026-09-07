"use client";

import { useExitBackup } from "@/hooks/useExitBackup";

/**
 * ExitBackupMounter
 * Thin client component that mounts the useExitBackup hook.
 * Renders nothing - purely a side-effect component.
 * Placed inside the dashboard layout to cover all dashboard pages.
 */
export function ExitBackupMounter() {
  useExitBackup();
  return null;
}
