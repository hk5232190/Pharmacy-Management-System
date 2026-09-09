"use client";

import { useExitBackup } from "@/hooks/useExitBackup";
import { useAuth } from "@/contexts/AuthContext";

/**
 * ExitBackupMounter
 * Thin client component that mounts the useExitBackup hook.
 * Renders nothing - purely a side-effect component.
 * Placed inside the dashboard layout to cover all dashboard pages.
 * Cashiers skip the safety backup (admin-only concern).
 */
export function ExitBackupMounter() {
  const { user } = useAuth();
  useExitBackup(user.role !== "cashier");
  return null;
}
