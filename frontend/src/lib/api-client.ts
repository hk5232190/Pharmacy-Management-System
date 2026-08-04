// A centralized API client that automatically handles attaching the JWT token
// to all requests. This ensures authentication is never missing.

const BASE_URL = "http://localhost:8000/api/v1";

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export const apiClient = {
  get: (endpoint: string, options?: FetchOptions) => fetchAPI(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, data: any, options?: FetchOptions) => fetchAPI(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint: string, data?: any, options?: FetchOptions) => fetchAPI(endpoint, { ...options, method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: (endpoint: string, options?: FetchOptions) => fetchAPI(endpoint, { ...options, method: 'DELETE' })
};

async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  // 1. Get token
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem("access_token") || sessionStorage.getItem("access_token")) 
    : null;

  // 2. Setup Headers
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 3. Setup URL
  let url = new URL(`${BASE_URL}${endpoint}`);
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // 4. Fetch
  const response = await fetch(url.toString(), {
    ...options,
    headers
  });

  const data = await response.json();
  
  // Return consistent format so components don't have to guess
  // If response was not ok, make sure data has success=false
  if (!response.ok) {
    return {
      success: false,
      error: data.detail?.[0]?.msg || data.detail || data.error || "An unknown error occurred"
    };
  }

  return data;
}
