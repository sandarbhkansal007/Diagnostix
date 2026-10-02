import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./hooks/useAuth";

const user = { id: 27, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" };

function AuthState() {
  const { user: currentUser, isLoading } = useAuth();
  return <p>{isLoading ? "Loading session" : currentUser ? currentUser.email : "Signed out"}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  sessionStorage.clear();
});

describe("AuthProvider", () => {
  it("restores the current user from the stored token", async () => {
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(user), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    expect(await screen.findByText("patient@example.com")).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/me");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer valid-token",
    );
  });

  it("clears an invalid token and resolves to signed out", async () => {
    sessionStorage.setItem("diagnostix.access_token", "expired-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    expect(await screen.findByText("Signed out")).toBeTruthy();
    expect(sessionStorage.getItem("diagnostix.access_token")).toBeNull();
  });
});