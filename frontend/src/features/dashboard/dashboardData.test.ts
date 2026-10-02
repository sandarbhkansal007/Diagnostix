import { describe, expect, it } from "vitest";
import { formatAmount, formatAppointmentDateTime, getGreeting, getUpcomingBookings } from "./dashboardData";
import type { Booking } from "./types";

function makeBooking(
  id: number,
  status: Booking["status"],
  appointment_datetime: string,
): Booking {
  return {
    id,
    centre_test_id: id + 100,
    appointment_datetime,
    amount: "1250.00",
    status,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  };
}

describe("dashboard data utilities", () => {
  it("selects and sorts only future pending and confirmed appointments", () => {
    const bookings = [
      makeBooking(3, "CONFIRMED", "2026-10-04T10:00:00Z"),
      makeBooking(2, "CANCELLED", "2026-10-02T10:00:00Z"),
      makeBooking(1, "PENDING", "2026-10-02T09:00:00Z"),
      makeBooking(4, "FAILED", "2026-10-01T15:00:00Z"),
      makeBooking(5, "PENDING", "2026-09-30T15:00:00Z"),
    ];

    expect(getUpcomingBookings(bookings, new Date("2026-10-01T12:00:00Z")).map(({ id }) => id)).toEqual([
      1, 3,
    ]);
  });

  it("formats API amount strings without assuming a currency", () => {
    expect(formatAmount("1250.00")).toBe(
      new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        1250,
      ),
    );
    expect(formatAmount("unknown")).toBe("unknown");
  });

  it("formats timezone-qualified appointment timestamps for the local timezone", () => {
    const label = formatAppointmentDateTime("2026-10-02T14:30:00+05:30");

    expect(label.date).not.toContain("T");
    expect(label.time).not.toContain("T");
    expect(formatAppointmentDateTime("not-a-date")).toEqual({
      date: "Date unavailable",
      time: "",
    });
  });

  it("selects a greeting from the local hour", () => {
    expect(getGreeting(new Date(2026, 9, 1, 9))).toBe("Good morning");
    expect(getGreeting(new Date(2026, 9, 1, 14))).toBe("Good afternoon");
    expect(getGreeting(new Date(2026, 9, 1, 19))).toBe("Good evening");
  });
});