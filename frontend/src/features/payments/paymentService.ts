import { apiRequest } from "../../services/apiClient";

export interface Payment {
  readonly id: number;
  readonly booking_id: number;
  readonly amount: string;
  readonly status: "SUCCESS" | "FAILED" | "PENDING";
  readonly provider_payment_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PaymentRequest {
  readonly booking_id: number;
  readonly simulation_outcome: "SUCCESS" | "FAILED";
}

export function createPayment(payload: PaymentRequest): Promise<Payment> {
  return apiRequest<Payment, PaymentRequest>("payments", {
    method: "POST",
    body: payload,
  });
}
