import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/authContext";
import { BookingsPage } from "./BookingsPage";
import { fetchBookings } from "./bookingsService";

vi.mock("./bookingsService", () => ({ fetchBookings: vi.fn() }));

const mockFetchBookings = vi.mocked(fetchBookings);
const authValue = {
  user: { id: 1, email: "patient@example.com", created_at: "2026-09-30T10:00:00Z" },
  isLoading: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: () => undefined,
};

beforeEach(() => {
  mockFetchBookings.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BookingsPage", () => {
  it("loads and searches bookings", async () => {
    const user = userEvent.setup();
    mockFetchBookings.mockResolvedValue([
      { id: 12, centre_test_id: 2, appointment_datetime: "2026-10-04T10:00:00Z", amount: "180.00", status: "PENDING", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
      { id: 25, centre_test_id: 7, appointment_datetime: "2026-10-05T12:00:00Z", amount: "220.00", status: "CONFIRMED", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
    ]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <BookingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Booking #12")).toBeTruthy();
    await user.type(screen.getByLabelText("Search bookings"), "25");
    expect(screen.getByText("Booking #25")).toBeTruthy();
    expect(screen.queryByText("Booking #12")).toBeNull();
  });

  it("shows the retry state on failure", async () => {
    const user = userEvent.setup();
    mockFetchBookings
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([
        { id: 44, centre_test_id: 9, appointment_datetime: "2026-10-06T11:00:00Z", amount: "300.00", status: "CANCELLED", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" },
      ]);

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <BookingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Booking #44")).toBeTruthy();
  });
});
