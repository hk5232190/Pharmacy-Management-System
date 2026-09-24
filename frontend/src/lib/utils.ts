import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parses date-time strings from backend API into a local JavaScript Date object.
 * If the string represents a date-time without timezone offset (e.g. UTC stored by SQLite
 * such as "2026-09-24T12:37:00" or "2026-09-24 12:37:00"), it treats it as UTC so that
 * JavaScript converts it to the user's actual local PC/laptop time.
 */
export function parseDateTime(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const str = String(val).trim();
  if (!str) return new Date();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(str)) {
    if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
      const parsed = new Date(str.replace(' ', 'T') + 'Z');
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}
