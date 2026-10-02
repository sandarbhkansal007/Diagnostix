import { ApiError } from "../lib/apiError";
import { getAccessToken } from "../lib/authToken";

export interface ApiRequestOptions<TBody = never> extends Omit<RequestInit, "body"> {
  readonly authenticated?: boolean;
  readonly body?: TBody;
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

export async function apiRequest<TResponse, TBody = never>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<TResponse> {
  const { authenticated = true, body, headers: requestHeaders, ...requestInit } = options;
  const headers = new Headers(requestHeaders);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = authenticated ? getAccessToken() : null;
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}/${path.replace(/^\/+/, "")}`, {
    ...requestInit,
    credentials: requestInit.credentials ?? "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: unknown;
  if (response.status !== 204 && response.headers.get("content-type")?.includes("application/json")) {
    payload = await response.json().catch(() => undefined);
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload as TResponse;
}