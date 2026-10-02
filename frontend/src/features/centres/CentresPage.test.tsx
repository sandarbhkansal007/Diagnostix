import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/authContext";
import { CentreDetailPage } from "./CentreDetailPage";
import { CentresPage } from "./CentresPage";
import { fetchCentreById, fetchCentreTests, fetchCentres } from "./centreService";

vi.mock("./centreService", () => ({
  fetchCentres: vi.fn(),
  fetchCentreById: vi.fn(),
  fetchCentreTests: vi.fn(),
}));

const mockFetchCentres = vi.mocked(fetchCentres);
const mockFetchCentreById = vi.mocked(fetchCentreById);
const mockFetchCentreTests = vi.mocked(fetchCentreTests);

const authValue = {
  user: { id: 1, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  isLoading: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: async () => undefined,
};

beforeEach(() => {
  mockFetchCentres.mockReset();
  mockFetchCentreById.mockReset();
  mockFetchCentreTests.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CentresPage", () => {
  it("loads real centres and supports client-side search", async () => {
    const user = userEvent.setup();
    mockFetchCentres.mockResolvedValue([
      { id: 1, name: "City Diagnostics", location: "Downtown", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
      { id: 2, name: "North Clinic", location: "North side", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
    ]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <CentresPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("City Diagnostics")).toBeTruthy();
    expect(screen.getByText("North Clinic")).toBeTruthy();

    await user.type(screen.getByLabelText("Search centres"), "north");

    expect(screen.getByText("North Clinic")).toBeTruthy();
    expect(screen.queryByText("City Diagnostics")).toBeNull();
  });

  it("shows a loading state while the centres catalogue is fetched", () => {
    mockFetchCentres.mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <CentresPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status", { name: "Loading centres" })).toBeTruthy();
  });

  it("shows an error and retry state", async () => {
    const user = userEvent.setup();
    mockFetchCentres
      .mockRejectedValueOnce(new Error("request failed"))
      .mockResolvedValueOnce([
        { id: 3, name: "Harbor Centre", location: "Harbor district", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
      ]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <CentresPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Harbor Centre")).toBeTruthy();
  });

  it("renders the centre detail panel and supported tests with pricing", async () => {
    mockFetchCentreById.mockResolvedValue({
      id: 10,
      name: "Central Campus",
      location: "City centre",
      created_at: "2026-09-30T10:00:00Z",
      updated_at: "2026-09-30T10:00:00Z",
    });
    mockFetchCentreTests.mockResolvedValue([
      { id: 99, test_id: 7, test_name: "MRI scan", description: "Body imaging.", price: "340.00" },
    ]);

    render(
      <MemoryRouter initialEntries={["/app/centres/10"]}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route path="/app/centres/:centreId" element={<CentreDetailPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Central Campus")).toBeTruthy();
    expect(screen.getByText("MRI scan")).toBeTruthy();
    expect(screen.getByText("340.00")).toBeTruthy();
  });
});
