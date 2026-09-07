import { useEffect } from 'react';
import { fireExitBackupBeacon } from '@/lib/exit-backup';

/**
 * useExitBackup
 *
 * Registers a beforeunload listener that fires a keepalive backup request
 * when the user closes/refreshes the browser tab.
 *
 * Mount this hook once in the dashboard layout so it covers all dashboard pages.
 * The backend duplicate-guard (60 s window) prevents double-backups if the user
 * also clicks the logout button before closing the window.
 */
export function useExitBackup() {
  useEffect(() => {
    const handleBeforeUnload = () => {
      const token =
        localStorage.getItem('access_token') ||
        sessionStorage.getItem('access_token');
      if (!token) return;
      fireExitBackupBeacon(token);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
