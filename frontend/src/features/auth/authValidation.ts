import type { AuthCredentials } from "./types";

export interface AuthFieldErrors {
  readonly email?: string;
  readonly password?: string;
}

export function validateAuthCredentials(credentials: AuthCredentials): AuthFieldErrors {
  const errors: { email?: string; password?: string } = {};
  const email = credentials.email.trim();

  if (!email) {
    errors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!credentials.password) {
    errors.password = "Enter your password.";
  } else if (credentials.password.length < 8 || credentials.password.length > 128) {
    errors.password = "Password must be between 8 and 128 characters.";
  }

  return errors;
}