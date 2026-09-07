/**
 * exit-backup.ts
 * Shared utility for triggering backup-on-exit calls.
 *
 * triggerExitBackup      - awaitable, used during user-initiated logout (sidebar/header)
 * fireExitBackupBeacon   - keepalive fire-and-forget, used in window beforeunload
 */

const BACKUP_ON_EXIT_URL = 'http://127.0.0.1:8000/api/v1/backup/backup-on-exit';

export interface ExitBackupResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Await this during user-initiated logout.
 * Never throws - always returns an ExitBackupResult so the caller controls the UI.
 */
export async function triggerExitBackup(token: string): Promise<ExitBackupResult> {
  if (!token) return { success: true, skipped: true };
  try {
    const res = await fetch(BACKUP_ON_EXIT_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.skipped) return { success: true, skipped: true };
      return { success: true };
    }
    let errorMsg = 'HTTP ' + String(res.status);
    try {
      const errData = await res.json();
      if (errData?.detail) errorMsg = String(errData.detail);
    } catch { /* body not parseable */ }
    return { success: false, error: errorMsg };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error during backup' };
  }
}

/**
 * Fire-and-forget for window beforeunload.
 * keepalive: true keeps the HTTP request alive after page close.
 * Backend records success/failure in BackupHistory regardless.
 */
export function fireExitBackupBeacon(token: string): void {
  if (!token) return;
  try {
    fetch(BACKUP_ON_EXIT_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      keepalive: true,
    });
    // Intentionally not awaited - browser keeps connection alive after page unload
  } catch { /* page is already closing - ignore */ }
}
