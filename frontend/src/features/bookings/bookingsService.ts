import { apiRequest } from "../../services/apiClient";

export interface Booking {
  readonly id: number;
  readonly centre_test_id: number;
  readonly appointment_datetime: string;
  readonly amount: string;
  readonly status: "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";
  readonly created_at: string;
  readonly updated_at: string;
}

export interface BookingCreateRequest {
  readonly centre_test_id: number;
  readonly appointment_datetime: string;
}

export function fetchBookings(): Promise<Booking[]> {
  return apiRequest<Booking[]>("bookings");
}

export function fetchBookingById(bookingId: number): Promise<Booking> {
  return apiRequest<Booking>(`bookings/${bookingId}`);
}

export function createBooking(payload: BookingCreateRequest): Promise<Booking> {
  return apiRequest<Booking, BookingCreateRequest>("bookings", {
    method: "POST",
    body: payload,
  });
}

export function cancelBooking(bookingId: number): Promise<Booking> {
  return apiRequest<Booking>(`bookings/${bookingId}/cancel`, {
    method: "POST",
  });
}
