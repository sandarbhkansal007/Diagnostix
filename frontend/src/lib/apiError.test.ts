import { describe, expect, it } from "vitest";
import { ApiError } from "./apiError";

describe("ApiError", () => {
  it("uses FastAPI string details as its message", () => {
    const error = new ApiError(401, { detail: "Invalid credentials" });

    expect(error.message).toBe("Invalid credentials");
    expect(error.status).toBe(401);
  });

  it("preserves FastAPI validation issues", () => {
    const issues = [{ loc: ["body", "email"], msg: "Invalid email", type: "value_error" }];
    const error = new ApiError(422, { detail: issues });

    expect(error.message).toBe("Request failed with status 422");
    expect(error.detail).toEqual(issues);
  });

  it("rejects malformed validation issue locations", () => {
    const error = new ApiError(422, {
      detail: [{ loc: ["body", {}], msg: "Invalid email", type: "value_error" }],
    });

    expect(error.detail).toBeUndefined();
  });

  it("provides a status-based fallback for unknown error bodies", () => {
    const error = new ApiError(503, { message: "Unavailable" });

    expect(error.message).toBe("Request failed with status 503");
    expect(error.detail).toBeUndefined();
  });
});