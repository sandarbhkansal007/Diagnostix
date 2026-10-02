import { setAccessToken } from "../../lib/authToken";
import { apiRequest } from "../../services/apiClient";
import type { AuthCredentials, AuthResponse, AuthUser } from "./types";

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