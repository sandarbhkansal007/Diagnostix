import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/authContext";
import { SettingsPage } from "./SettingsPage";

const authValue = {
  user: { id: 9, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  isLoading: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: vi.fn(),
};

describe("SettingsPage", () => {
  it("shows the user email and logs out", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("patient@example.com")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(authValue.logout).toHaveBeenCalledTimes(1);
  });
});
