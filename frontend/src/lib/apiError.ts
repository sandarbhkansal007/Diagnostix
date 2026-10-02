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

function readTextFromDetail(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if ("msg" in value && typeof value.msg === "string" && value.msg.trim()) {
    return value.msg.trim();
  }

  if ("message" in value && typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }

  if ("detail" in value) {
    return readTextFromDetail(value.detail);
  }

  return undefined;
}

function readDetail(payload: unknown): ApiErrorDetail | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  if (!("detail" in payload)) {
    return undefined;
  }

  const detail = payload.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.every(isValidationIssue)) {
    return detail;
  }

  const textDetail = readTextFromDetail(detail);
  if (textDetail) {
    return textDetail;
  }

  return undefined;
}

function getDetailMessage(detail: ApiErrorDetail | undefined): string | undefined {
  if (typeof detail === "string") {
    return detail.trim() || undefined;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((issue) => (typeof issue === "object" && issue !== null && "msg" in issue ? issue.msg : undefined))
      .filter((message): message is string => typeof message === "string" && message.trim().length > 0);

    if (messages.length > 0) {
      return messages.join(". ");
    }
  }

  return undefined;
}

export function formatApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) {
    const detailMessage = getDetailMessage(error.detail);
    if (detailMessage) {
      return detailMessage;
    }

    if (error.message && error.message !== `Request failed with status ${error.status}`) {
      return error.message;
    }

    return fallback;
  }

  if (error instanceof Error) {
    if (error.message && error.message.trim()) {
      return error.message.trim();
    }

    return fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error === "object" && error !== null) {
    const text = readTextFromDetail(error);
    if (text) {
      return text;
    }
  }

  return fallback;
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