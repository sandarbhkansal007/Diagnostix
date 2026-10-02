import { LoaderCircle } from "lucide-react";

export function AuthLoading() {
  return (
    <main className="auth-loading" aria-live="polite">
      <LoaderCircle className="auth-loading__icon" size={22} aria-hidden="true" />
      <span>Restoring your session</span>
    </main>
  );
}