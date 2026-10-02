import type { Booking } from "./types";

export interface DateTimeLabel {
  readonly date: string;
  readonly time: string;
}

export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function getUpcomingBookings(bookings: readonly Booking[], now = new Date()): Booking[] {
  return bookings
    .filter((booking) => {
      if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
        return false;
      }

      const appointmentTime = new Date(booking.appointment_datetime).getTime();
      return Number.isFinite(appointmentTime) && appointmentTime > now.getTime();
    })
    .sort(
      (first, second) =>
        new Date(first.appointment_datetime).getTime() -
        new Date(second.appointment_datetime).getTime(),
    );
}

export function formatAppointmentDateTime(value: string): DateTimeLabel {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return { date: "Date unavailable", time: "" };
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

export function formatAmount(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}