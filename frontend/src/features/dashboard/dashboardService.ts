import { apiRequest } from "../../services/apiClient";
import type { Booking, DiagnosticCentre, DiagnosticTest } from "./types";

export function fetchBookings(): Promise<Booking[]> {
  return apiRequest<Booking[]>("bookings");
}

export function fetchDiagnosticTests(): Promise<DiagnosticTest[]> {
  return apiRequest<DiagnosticTest[]>("tests");
}

export function fetchDiagnosticCentres(): Promise<DiagnosticCentre[]> {
  return apiRequest<DiagnosticCentre[]>("centres");
}