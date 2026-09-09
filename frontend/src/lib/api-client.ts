// A centralized API client that automatically handles attaching the JWT token
// to all requests. This ensures authentication is never missing.

import { resetAuthState } from "@/lib/auth-session";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

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

  const url = new URL(`${API_BASE_URL}${endpoint}`);
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
