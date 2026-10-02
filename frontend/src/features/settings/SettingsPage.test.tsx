import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/authContext";
import { SettingsPage } from "./SettingsPage";

const buildAuthValue = () => ({
  user: { id: 9, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  isLoading: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: vi.fn(async () => undefined),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPage", () => {
  it("loads the profile from the backend and updates the email", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, email: "updated@example.com", created_at: "2026-09-30T10:00:00Z" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const authValue = buildAuthValue();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("patient@example.com")).toBeTruthy();
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "updated@example.com");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByDisplayValue("updated@example.com")).toBeTruthy();
    });
  });

  it("shows a readable message for an incorrect current password and never prints [object Object]", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Current password is incorrect" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const authValue = buildAuthValue();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await screen.findByDisplayValue("patient@example.com");
    await user.type(screen.getByLabelText("Current password"), "wrong-password");
    await user.type(screen.getByLabelText("New password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Current password is incorrect");
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("processes a successful password change and logs the user out", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Password updated successfully" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const authValue = buildAuthValue();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await screen.findByDisplayValue("patient@example.com");
    await user.type(screen.getByLabelText("Current password"), "correct-horse-battery-staple");
    await user.type(screen.getByLabelText("New password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    const statusMessage = await screen.findByRole("status");
    expect(statusMessage.textContent).toContain("Password updated successfully");
    await waitFor(() => {
      expect(authValue.logout).toHaveBeenCalledTimes(1);
    });
  });

  it("logs out through the auth provider", async () => {
    const user = userEvent.setup();
    const authValue = buildAuthValue();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(authValue.logout).toHaveBeenCalledTimes(1);
  });
});
