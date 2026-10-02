import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/apiError";
import { getAuthErrorMessage } from "./authErrorMessage";

describe("getAuthErrorMessage", () => {
  it("maps expected auth and API failures to human-readable messages", () => {
    expect(getAuthErrorMessage(new ApiError(401, { detail: "Invalid credentials" }))).toBe(
      "The email or password you entered is incorrect.",
    );
    expect(getAuthErrorMessage(new ApiError(404, { detail: "Not found" }))).toContain(
      "temporarily unavailable",
    );
    expect(getAuthErrorMessage(new ApiError(409, { detail: "Email exists" }))).toContain(
      "already exists",
    );
    expect(
      getAuthErrorMessage(
        new ApiError(422, {
          detail: [{ loc: ["body", "password"], msg: "Too short", type: "value_error" }],
        }),
      ),
    ).toContain("8 and 128 characters");
  });

  it("hides network error details behind a useful message", () => {
    expect(getAuthErrorMessage(new TypeError("Failed to fetch"))).toContain(
      "Check your connection",
    );
  });
});