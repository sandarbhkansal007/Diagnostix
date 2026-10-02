import { ApiError } from "../../lib/apiError";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "The email or password you entered is incorrect.";
    }
    if (error.status === 409) {
      return "An account with this email address already exists.";
    }
    if (error.status === 422) {
      const issues = Array.isArray(error.detail) ? error.detail : [];
      if (issues.some((issue) => issue.loc.includes("email"))) {
        return "Enter a valid email address.";
      }
      if (issues.some((issue) => issue.loc.includes("password"))) {
        return "Password must be between 8 and 128 characters.";
      }
      return "Check your information and try again.";
    }
    if (error.status === 404 || error.status >= 500) {
      return "Authentication is temporarily unavailable. Please try again later.";
    }
  }

  if (error instanceof TypeError) {
    return "Unable to reach Diagnostix. Check your connection and try again.";
  }

  return "We couldn't complete your request. Please try again.";
}