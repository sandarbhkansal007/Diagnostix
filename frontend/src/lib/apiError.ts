import type { ApiErrorDetail, ApiValidationIssue } from "../types/api";

function isValidationIssue(value: unknown): value is ApiValidationIssue {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("loc" in value) || !("msg" in value) || !("type" in value)) {
    return false;
  }

  const location = value.loc;
  return (
    Array.isArray(location) &&
    location.every((part: unknown) => typeof part === "string" || typeof part === "number") &&
    typeof value.msg === "string" &&
    typeof value.type === "string"
  );
}

function readDetail(payload: unknown): ApiErrorDetail | undefined {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return undefined;
  }

  const detail = payload.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.every(isValidationIssue)) {
    return detail;
  }

  return undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: ApiErrorDetail | undefined;

  constructor(status: number, payload: unknown) {
    const detail = readDetail(payload);
    super(typeof detail === "string" ? detail : `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}