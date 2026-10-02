import { apiRequest } from "../../services/apiClient";
import type { DiagnosticCentre } from "../dashboard/types";

export interface CentreTestOffer {
  readonly id: number;
  readonly test_id: number;
  readonly test_name: string;
  readonly description: string | null;
  readonly price: string;
}

export function fetchCentres(): Promise<DiagnosticCentre[]> {
  return apiRequest<DiagnosticCentre[]>("centres");
}

export function fetchCentreById(centreId: number): Promise<DiagnosticCentre> {
  return apiRequest<DiagnosticCentre>(`centres/${centreId}`);
}

export function fetchCentreTests(centreId: number): Promise<CentreTestOffer[]> {
  return apiRequest<CentreTestOffer[]>(`centres/${centreId}/tests`);
}
