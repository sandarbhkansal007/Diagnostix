export type BookingStatus = "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";

export interface Booking {
  readonly id: number;
  readonly centre_test_id: number;
  readonly appointment_datetime: string;
  readonly amount: string;
  readonly status: BookingStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DiagnosticTest {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DiagnosticCentre {
  readonly id: number;
  readonly name: string;
  readonly location: string;
  readonly created_at: string;
  readonly updated_at: string;
}