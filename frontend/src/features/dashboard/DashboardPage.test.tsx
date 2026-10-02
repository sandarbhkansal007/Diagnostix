import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/authContext";
import { ApiError } from "../../lib/apiError";
import { DashboardPage } from "./DashboardPage";
import { fetchBookings, fetchDiagnosticCentres, fetchDiagnosticTests } from "./dashboardService";
import type { Booking, DiagnosticCentre, DiagnosticTest } from "./types";

vi.mock("./dashboardService", () => ({
  fetchBookings: vi.fn(),
  fetchDiagnosticCentres: vi.fn(),
  fetchDiagnosticTests: vi.fn(),
}));

const mockFetchBookings = vi.mocked(fetchBookings);
const mockFetchDiagnosticCentres = vi.mocked(fetchDiagnosticCentres);
const mockFetchDiagnosticTests = vi.mocked(fetchDiagnosticTests);

const authenticatedUser = {
  id: 7,
  email: "patient@example.com",
  created_at: "2026-09-30T10:00:00Z",
};

const authValue: AuthContextValue = {
  user: authenticatedUser,
  isLoading: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: () => undefined,
};

const bookings: Booking[] = [
  {
    id: 21,
    centre_test_id: 4,
    appointment_datetime: "2099-12-05T14:30:00+05:30",
    amount: "120.50",
    status: "PENDING",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
  },
  {
    id: 22,
    centre_test_id: 5,
    appointment_datetime: "2099-12-06T09:00:00Z",
    amount: "200.00",
    status: "CANCELLED",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
  },
  {
    id: 23,
    centre_test_id: 6,
    appointment_datetime: "2099-12-07T09:00:00Z",
    amount: "80.00",
    status: "FAILED",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
  },
];

const tests: DiagnosticTest[] = [
  {
    id: 3,
    name: "Complete blood count",
    description: "A standard blood panel.",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
  },
  {
    id: 4,
    name: "Lipid profile",
    description: null,
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
  },
];

const centres: DiagnosticCentre[] = [
  {
    id: 8,
    name: "Central Diagnostics",
    location: "North district",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
  },
];

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <AuthContext.Provider value={authValue}>
        <DashboardPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFetchBookings.mockResolvedValue(bookings);
  mockFetchDiagnosticTests.mockResolvedValue(tests);
  mockFetchDiagnosticCentres.mockResolvedValue(centres);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("DashboardPage", () => {
  it("greets the authenticated user and derives summary counts from API data", async () => {
    renderDashboard();

    expect(await screen.findByText("patient@example.com")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();

    const summary = screen.getByRole("region", { name: "At a glance" });
    expect(
      within(summary).getByText("Upcoming appointments").parentElement?.parentElement?.textContent,
    ).toContain("1");
    expect(
      within(summary).getByText("Total bookings").parentElement?.parentElement?.textContent,
    ).toContain("3");
    expect(
      within(summary).getByText("Available tests").parentElement?.parentElement?.textContent,
    ).toContain("2");
    expect(
      within(summary).getByText("Diagnostic centres").parentElement?.parentElement?.textContent,
    ).toContain("1");
  });

  it("shows real booking reference, local appointment time, amount, and status", async () => {
    renderDashboard();

    expect(await screen.findByText("Booking #21")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Amount 120.50")).toBeTruthy();
    expect(screen.getByText("Offering reference #4")).toBeTruthy();
    expect(screen.queryByText("Booking #22")).toBeNull();
    expect(screen.queryByText("Booking #23")).toBeNull();
  });

  it("shows real diagnostic test and centre fields without invented pricing or metadata", async () => {
    renderDashboard();

    expect(await screen.findByText("Complete blood count")).toBeTruthy();
    expect(screen.getByText("A standard blood panel.")).toBeTruthy();
    expect(screen.getByText("Lipid profile")).toBeTruthy();
    expect(screen.getByText("Central Diagnostics")).toBeTruthy();
    expect(screen.getByText("North district")).toBeTruthy();
    expect(screen.queryByText(/rating|open now|\$\d/i)).toBeNull();
  });

  it("shows true empty states and zero values when the APIs return empty arrays", async () => {
    mockFetchBookings.mockResolvedValue([]);
    mockFetchDiagnosticTests.mockResolvedValue([]);
    mockFetchDiagnosticCentres.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText("No upcoming appointments")).toBeTruthy();
    expect(screen.getByText("No diagnostic tests are available yet.")).toBeTruthy();
    expect(screen.getByText("No diagnostic centres are available yet.")).toBeTruthy();

    const summary = screen.getByRole("region", { name: "At a glance" });
    for (const label of [
      "Upcoming appointments",
      "Total bookings",
      "Available tests",
      "Diagnostic centres",
    ]) {
      expect(within(summary).getByText(label).parentElement?.parentElement?.textContent).toContain(
        "0",
      );
    }
  });

  it("shows loading state while independent dashboard requests are pending", () => {
    mockFetchBookings.mockReturnValue(new Promise(() => undefined));
    mockFetchDiagnosticTests.mockReturnValue(new Promise(() => undefined));
    mockFetchDiagnosticCentres.mockReturnValue(new Promise(() => undefined));
    renderDashboard();

    expect(screen.getByRole("status", { name: "Loading upcoming appointments" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading diagnostic tests" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading diagnostic centres" })).toBeTruthy();
  });

  it("isolates section failures and retries the failed bookings request", async () => {
    const user = userEvent.setup();
    mockFetchBookings
      .mockRejectedValueOnce(new ApiError(500, undefined))
      .mockResolvedValueOnce([]);
    renderDashboard();

    expect(await screen.findByText("This section could not be loaded. Please try again.")).toBeTruthy();
    expect(screen.getByText("Complete blood count")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No upcoming appointments")).toBeTruthy();
    expect(mockFetchBookings).toHaveBeenCalledTimes(2);
  });

  it("links quick actions to the existing placeholder routes", async () => {
    renderDashboard();

    expect((await screen.findByRole("link", { name: "Browse tests" })).getAttribute("href")).toBe(
      "/app/tests",
    );
    expect(screen.getByRole("link", { name: "Find centres" }).getAttribute("href")).toBe(
      "/app/centres",
    );
    expect(screen.getAllByRole("link", { name: /View bookings/ })[0]?.getAttribute("href")).toBe(
      "/app/bookings",
    );
  });
});