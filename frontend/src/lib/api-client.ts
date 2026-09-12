// A centralized API client that automatically handles attaching the JWT token
// to all requests. This ensures authentication is never missing.

import { resetAuthState } from "@/lib/auth-session";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

// Cache the resolved port so we only call Tauri once
let _resolvedPort: number | null = null;

/**
 * Resolve the backend API base URL.
 * - In Tauri (production): polls the Rust `get_api_port` command until the
 *   Python sidecar has started and announced its port. Retries for up to 60s
 *   to cover first-run antivirus scanning of the packaged Python executable.
 * - In browser/dev mode: falls back to the static NEXT_PUBLIC_API_BASE_URL.
 */
export async function resolveApiBaseUrl(): Promise<string> {
  // If already resolved, return cached value immediately
  if (_resolvedPort !== null) {
    return `http://127.0.0.1:${_resolvedPort}/api/v1`;
  }

  // Check if we are inside Tauri
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Poll until the backend has started (port becomes non-zero)
      for (let i = 0; i < 120; i++) {
        const port: number = await invoke('get_api_port');
        if (port && port > 0) {
          _resolvedPort = port;
          // Also set the global for any legacy callers
          (window as any).__PMS_API_PORT__ = port;
          return `http://127.0.0.1:${port}/api/v1`;
        }
        // Backend not ready yet – wait 500ms and retry
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.warn('Tauri invoke failed, falling back to default port:', e);
    }
  }

  return API_BASE_URL;
}

/** Synchronous fallback for contexts that can't be async (rare). */
export function getApiBaseUrl(): string {
  if (_resolvedPort !== null) {
    return `http://127.0.0.1:${_resolvedPort}/api/v1`;
  }
  if (typeof window !== 'undefined' && (window as any).__PMS_API_PORT__) {
    return `http://127.0.0.1:${(window as any).__PMS_API_PORT__}/api/v1`;
  }
  return API_BASE_URL;
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

type RequestBody = BodyInit | object | null | undefined;
// Existing screens consume heterogeneous, untyped response shapes. Keep the
// loose default at this compatibility boundary while new callers supply T.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyApiResponse = any;

export const apiClient = {
  get: <T = LegacyApiResponse>(endpoint: string, options?: FetchOptions) =>
    fetchAPI<T>(endpoint, { ...options, method: "GET" }),
  post: <T = LegacyApiResponse>(endpoint: string, data?: RequestBody, options?: FetchOptions) =>
    fetchAPI<T>(endpoint, withBody(options, "POST", data)),
  put: <T = LegacyApiResponse>(endpoint: string, data?: RequestBody, options?: FetchOptions) =>
    fetchAPI<T>(endpoint, withBody(options, "PUT", data)),
  delete: <T = LegacyApiResponse>(endpoint: string, options?: FetchOptions) =>
    fetchAPI<T>(endpoint, { ...options, method: "DELETE" }),
};

function withBody(options: FetchOptions | undefined, method: string, data: RequestBody): FetchOptions {
  const body = data == null || typeof data === "string" || data instanceof FormData || data instanceof URLSearchParams || data instanceof Blob
    ? data as BodyInit | null | undefined
    : JSON.stringify(data);
  return { ...options, method, body };
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
}

function getErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "An unknown error occurred";
  const payload = data as Record<string, unknown>;
  const detail = payload.detail;
  if (Array.isArray(detail)) return detail[0]?.msg ?? "Request validation failed";
  if (typeof detail === "string") return detail;
  if (typeof payload.error === "string") return payload.error;
  return "An unknown error occurred";
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const token = getAccessToken();

  const headers = new Headers(options.headers || {});
  if (options.body != null && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrl = await resolveApiBaseUrl();
  const url = new URL(`${baseUrl}${endpoint}`);
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value != null) url.searchParams.append(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers
  });

  // Handle global 401 Unauthorized securely before attempting to parse JSON
if (response.status === 401) {
    if (typeof window !== 'undefined') {
      resetAuthState();
      window.location.href = '/';
    }
    return { success: false, error: "Session expired" } as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { success: false, error: getErrorMessage(data) } as T;
  }

  return data as T;
}
