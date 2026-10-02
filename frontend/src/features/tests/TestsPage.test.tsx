import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/authContext";
import { TestsPage } from "./TestsPage";
import { fetchTests } from "./testsService";

vi.mock("./testsService", () => ({
  fetchTests: vi.fn(),
}));

const mockFetchTests = vi.mocked(fetchTests);

const authValue = {
  user: { id: 1, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  isLoading: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: () => undefined,
};

beforeEach(() => {
  mockFetchTests.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TestsPage", () => {
  it("loads real tests and supports client-side search", async () => {
    const user = userEvent.setup();
    mockFetchTests.mockResolvedValue([
      { id: 1, name: "Complete blood count", description: "A standard blood panel.", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
      { id: 2, name: "Lipid profile", description: "A cholesterol panel.", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
    ]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <TestsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Complete blood count")).toBeTruthy();
    expect(screen.getByText("Lipid profile")).toBeTruthy();

    await user.type(screen.getByLabelText("Search tests"), "lipid");

    expect(screen.getByText("Lipid profile")).toBeTruthy();
    expect(screen.queryByText("Complete blood count")).toBeNull();
  });

  it("shows the loading state while the catalogue is fetched", () => {
    mockFetchTests.mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <TestsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status", { name: "Loading tests" })).toBeTruthy();
  });

  it("shows an error and retries", async () => {
    const user = userEvent.setup();
    mockFetchTests
      .mockRejectedValueOnce(new Error("request failed"))
      .mockResolvedValueOnce([
        { id: 3, name: "MRI scan", description: "Body imaging.", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
      ]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <TestsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("MRI scan")).toBeTruthy();
  });

  it("shows a polished empty state when no tests exist", async () => {
    mockFetchTests.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <TestsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("No diagnostic tests available")).toBeTruthy();
  });
});
