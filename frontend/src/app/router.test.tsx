import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "./router";

const authResponse = {
  user: { id: 27, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  access_token: "issued-token",
  token_type: "bearer",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockSuccessfulAuth() {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/login") || url.endsWith("/auth/signup")) {
      return jsonResponse(authResponse, url.endsWith("/auth/signup") ? 201 : 200);
    }
    if (url.endsWith("/auth/me")) {
      return jsonResponse(authResponse.user);
    }
    if (url.endsWith("/tests") || url.endsWith("/centres") || url.endsWith("/bookings")) {
      return jsonResponse([]);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("authentication routes", () => {
  it("redirects a logged-out visitor from a protected app route to login", async () => {
    window.history.replaceState(null, "", "/app/dashboard");
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

  it("validates login fields before submitting", async () => {
    const user = userEvent.setup();
    const fetchMock = mockSuccessfulAuth();
    render(<AppRouter />);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your email address.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a human-readable login error for rejected credentials", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ detail: "Invalid credentials" }, 401),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AppRouter />);

    await user.type(await screen.findByLabelText("Email"), "patient@example.com");
    await user.type(screen.getByLabelText("Password"), "secure-pass-123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The email or password you entered is incorrect.",
    );
  });

  it("signs in, opens the protected placeholder, and signs out", async () => {
    const user = userEvent.setup();
    mockSuccessfulAuth();
    render(<AppRouter />);

    await user.type(await screen.findByLabelText("Email"), "patient@example.com");
    await user.type(screen.getByLabelText("Password"), "secure-pass-123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();
    expect(sessionStorage.getItem("diagnostix.access_token")).toBe("issued-token");
    expect(screen.getAllByText("patient@example.com")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(sessionStorage.getItem("diagnostix.access_token")).toBeNull();
  });

  it("creates an account and opens the dashboard placeholder", async () => {
    const user = userEvent.setup();
    mockSuccessfulAuth();
    render(<AppRouter />);

    await user.click(await screen.findByRole("link", { name: "Sign up" }));
    await user.type(screen.getByLabelText("Email"), "patient@example.com");
    await user.type(screen.getByLabelText("Password"), "secure-pass-123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();
  });

  it("redirects an authenticated visitor away from login after session restoration", async () => {
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/login");
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();
  });
});

describe("authenticated application shell", () => {
  it("redirects /app to /app/dashboard", async () => {
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/app");
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/dashboard");
  });

  it("renders all sidebar routes and marks the current route active", async () => {
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/app/dashboard");
    render(<AppRouter />);

    await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/ });
    const destinations = [
      "Dashboard",
      "Tests",
      "Diagnostic Centres",
      "Bookings",
      "Reports",
      "Settings",
    ];

    for (const destination of destinations) {
      expect(screen.getByRole("link", { name: destination })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("changes placeholder route and active navigation when a sidebar link is selected", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/app/dashboard");
    render(<AppRouter />);

    await user.click(await screen.findByRole("link", { name: "Tests" }));

    expect(await screen.findByRole("heading", { name: "Tests" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tests" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("redirects protected child routes when no session exists", async () => {
    window.history.replaceState(null, "", "/app/bookings");
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

  it.each(["/login", "/signup"])("redirects authenticated visits to %s", async (path) => {
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", path);
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/dashboard");
  });

  it("opens and closes the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/app/dashboard");
    render(<AppRouter />);

    await user.click(await screen.findByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "Mobile navigation" })).toBeTruthy();

    await user.click(
      within(screen.getByRole("dialog", { name: "Mobile navigation" })).getByRole("button", {
        name: "Close navigation",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Mobile navigation" })).toBeNull();
  });

  it("closes the mobile drawer with Escape and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/app/dashboard");
    render(<AppRouter />);

    const menuButton = await screen.findByRole("button", { name: "Open navigation" });
    await user.click(menuButton);
    const mobileDialog = screen.getByRole("dialog", { name: "Mobile navigation" });
    expect(document.activeElement).toBe(within(mobileDialog).getByRole("link", { name: "Dashboard" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Mobile navigation" })).toBeNull();
    expect(document.activeElement).toBe(menuButton);
  });

  it("opens and closes the assistant placeholder", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("diagnostix.access_token", "valid-token");
    mockSuccessfulAuth();
    window.history.replaceState(null, "", "/app/dashboard");
    render(<AppRouter />);

    await user.click(await screen.findByRole("button", { name: "Open Diagnostix Assistant" }));
    expect(screen.getByRole("heading", { name: "Diagnostix Assistant" })).toBeTruthy();
    expect(screen.getByText("AI assistant coming soon.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Close assistant" }));
    expect(screen.queryByRole("heading", { name: "Diagnostix Assistant" })).toBeNull();
  });
});