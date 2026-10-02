import { apiRequest } from "../../services/apiClient";
import type { DiagnosticTest } from "../dashboard/types";

export function fetchTests(): Promise<DiagnosticTest[]> {
  return apiRequest<DiagnosticTest[]>("tests");
}
