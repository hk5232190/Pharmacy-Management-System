// A centralized API client that automatically handles attaching the JWT token
// to all requests. This ensures authentication is never missing.

import { resetAuthState } from "@/lib/auth-session";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

// ─── Port resolution — singleton Promise ─────────────────────────────────────
// Uses THREE parallel detection mechanisms (all race; first wins):
//   1. Tauri "backend-ready" event (instant if fired after listener registered)
//   2. window.__PmsPortResolvers callback injected by Rust via window.eval()
//      (works even when the event fires before the listener is set up)
//   3. get_api_port Tauri command polled every 100ms (catches state updates)
// Once any mechanism resolves the port, _resolvedPort is cached and all
// subsequent calls return synchronously — no more per-page 60-second loops.

let _resolvedPort: number | null = null;
let _portPromise: Promise<number> | null = null;

function createPortPromise(): Promise<number> {
  return new Promise<number>((resolve) => {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) {
      resolve(8000); // dev / browser mode
      return;
    }

    let settled = false;
    const doResolve = (port: number) => {
      if (settled) return;
      settled = true;
      _resolvedPort = port;
      (window as any).__PMS_API_PORT__ = port;
      console.info("[PMS] Backend port resolved:", port);
      resolve(port);
    };

    // Mechanism 1: Rust calls window.__PmsPortResolvers[] via window.eval()
    // This works even if the event listener below registers after the event fires.
    if (!(window as any).__PmsPortResolvers) {
      (window as any).__PmsPortResolvers = [];
    }
    (window as any).__PmsPortResolvers.push(doResolve);

    // Also check if Rust already injected the port before this code ran.
    if ((window as any).__PMS_API_PORT__) {
      doResolve((window as any).__PMS_API_PORT__);
      return;
    }

    // Mechanism 2: Tauri backend-ready event
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen<number>("backend-ready", (event) => doResolve(event.payload));
      })
      .catch((e: unknown) => console.warn("[PMS] Event listener failed:", e));

    // Mechanism 3: Poll get_api_port every 100ms (reads Rust state or port.info)
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        while (!settled) {
          const port: number = await invoke("get_api_port");
          if (port > 0) {
            doResolve(port);
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch (e: unknown) {
        console.warn("[PMS] get_api_port poll error:", e);
      }
    })();
  });
}

/**
 * Resolve the backend API base URL.
 * - Tauri production: resolves via the first of three parallel mechanisms above.
 * - Dev/browser: returns the static NEXT_PUBLIC_API_BASE_URL instantly.
 */
export async function resolveApiBaseUrl(): Promise<string> {
  if (_resolvedPort !== null) {
    return `http://127.0.0.1:${_resolvedPort}/api/v1`;
  }
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    if (!_portPromise) _portPromise = createPortPromise();
    const port = await _portPromise;
    return `http://127.0.0.1:${port}/api/v1`;
  }
  return API_BASE_URL;
}

/** Synchronous fallback for rare contexts that cannot be async. */
export function getApiBaseUrl(): string {
  if (_resolvedPort !== null) {
    return `http://127.0.0.1:${_resolvedPort}/api/v1`;
  }
  if (typeof window !== "undefined" && (window as any).__PMS_API_PORT__) {
    return `http://127.0.0.1:${(window as any).__PMS_API_PORT__}/api/v1`;
  }
  return API_BASE_URL;
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

type RequestBody = BodyInit | object | null | undefined;
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
  const body =
    data == null ||
    typeof data === "string" ||
    data instanceof FormData ||
    data instanceof URLSearchParams ||
    data instanceof Blob
      ? (data as BodyInit | null | undefined)
      : JSON.stringify(data);
  return { ...options, method, body };
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
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
  if (
    options.body != null &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
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

  const response = await fetch(url.toString(), { ...options, headers });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      resetAuthState();
      window.location.href = "/";
    }
    return { success: false, error: "Session expired" } as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { success: false, error: getErrorMessage(data) } as T;
  }

  return data as T;
}