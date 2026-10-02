import { apiRequest } from "../../services/apiClient";

export interface Report {
  readonly id: number;
  readonly user_id: number;
  readonly booking_id: number;
  readonly status: string;
  readonly summary: string | null;
  readonly findings: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export function fetchReports(): Promise<Report[]> {
  return apiRequest<Report[]>("reports");
}

export function fetchReport(reportId: number): Promise<Report> {
  return apiRequest<Report>(`reports/${reportId}`);
}
