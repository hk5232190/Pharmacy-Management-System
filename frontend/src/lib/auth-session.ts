export function clearStoredTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
}

export function resetAuthState(): void {
  clearStoredTokens();
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("pms_auth_reset", String(Date.now()));
  } catch {
    // Storage may be unavailable (e.g. private mode) — event dispatch still works.
  }
  window.dispatchEvent(new Event("pms-auth-reset"));
}