import { clearAccessToken, setAccessToken } from "../../lib/authToken";
import { apiRequest } from "../../services/apiClient";
import type { AuthCredentials, AuthResponse, AuthUser } from "./types";

export interface ProfileUpdatePayload {
  readonly email?: string;
}

export interface PasswordChangePayload {
  readonly current_password: string;
  readonly new_password: string;
}

async function authenticate(
  endpoint: "login" | "signup",
  credentials: AuthCredentials,
): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse, AuthCredentials>(`auth/${endpoint}`, {
    method: "POST",
    body: credentials,
    authenticated: false,
  });

  setAccessToken(response.access_token);
  return response;
}

export function login(credentials: AuthCredentials): Promise<AuthResponse> {
  return authenticate("login", credentials);
}

export function signup(credentials: AuthCredentials): Promise<AuthResponse> {
  return authenticate("signup", credentials);
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("auth/me");
}

export function getProfile(): Promise<AuthUser> {
  return apiRequest<AuthUser>("auth/profile");
}

export function updateProfile(payload: ProfileUpdatePayload): Promise<AuthUser> {
  return apiRequest<AuthUser, ProfileUpdatePayload>("auth/profile", {
    method: "PUT",
    body: payload,
  });
}

export function changePassword(payload: PasswordChangePayload): Promise<{ message: string }> {
  return apiRequest<{ message: string }, PasswordChangePayload>("auth/change-password", {
    method: "POST",
    body: payload,
  });
}

export function logoutSession(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("auth/logout", {
    method: "POST",
  });
}

export function clearSession(): void {
  clearAccessToken();
}