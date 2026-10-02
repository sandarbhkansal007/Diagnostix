import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./apiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("serializes JSON and attaches the stored Bearer token", async () => {
    sessionStorage.setItem("diagnostix.access_token", "test-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 7 }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = { name: "Complete blood count" };
    const result = await apiRequest<{ id: number }, typeof body>("tests", {
      method: "POST",
      body,
    });

    const request = fetchMock.mock.calls[0];
    expect(result).toEqual({ id: 7 });
    expect(request?.[0]).toBe("/api/v1/tests");
    expect(request?.[1]?.body).toBe(JSON.stringify(body));
    expect(new Headers(request?.[1]?.headers).get("Content-Type")).toBe("application/json");
    expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("omits the stored token for public requests", async () => {
    sessionStorage.setItem("diagnostix.access_token", "test-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ ok: boolean }>("auth/login", { authenticated: false });

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("returns undefined for a successful no-content response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<void>("health")).resolves.toBeUndefined();
  });

  it("normalizes FastAPI validation responses", async () => {
    const issues = [{ loc: ["body", "email"], msg: "Invalid email", type: "value_error" }];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: issues }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest<never, { email: string }>("auth/login", {
        method: "POST",
        body: { email: "invalid" },
      }),
    ).rejects.toMatchObject({ status: 422, detail: issues });
  });
});