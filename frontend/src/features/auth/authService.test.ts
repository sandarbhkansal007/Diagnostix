import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, signup } from "./authService";

const authResponse = {
  user: { id: 27, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  access_token: "issued-token",
  token_type: "bearer",
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("authService", () => {
  it("sends login credentials to the backend and stores the returned token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(authResponse), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await login({ email: "patient@example.com", password: "secure-pass-123" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/login");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ email: "patient@example.com", password: "secure-pass-123" }),
    );
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
    expect(sessionStorage.getItem("diagnostix.access_token")).toBe("issued-token");
  });

  it("sends signup credentials to the backend and stores the returned token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(authResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await signup({ email: "patient@example.com", password: "secure-pass-123" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/signup");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(sessionStorage.getItem("diagnostix.access_token")).toBe("issued-token");
  });
});