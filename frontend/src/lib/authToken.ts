const ACCESS_TOKEN_KEY = "diagnostix.access_token";

// Keep this short-lived token scoped to the current tab; the backend has no refresh endpoint.
export function getAccessToken(): string | null {
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}