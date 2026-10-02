import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthForm } from "../components/AuthForm";
import { AuthLayout } from "../components/AuthLayout";
import { getAuthErrorMessage } from "../authErrorMessage";
import { useAuth } from "../hooks/useAuth";
import type { AuthCredentials } from "../types";
import { APP_ROUTES } from "../../../app/routePaths";

function getRedirectPath(state: unknown): string | undefined {
  if (typeof state !== "object" || state === null || !("from" in state)) {
    return undefined;
  }

  const from = state.from;
  if (typeof from !== "object" || from === null || !("pathname" in from)) {
    return undefined;
  }

  const { pathname } = from;
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return undefined;
  }

  return pathname;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = getRedirectPath(location.state) ?? APP_ROUTES.dashboard;

  async function handleLogin(credentials: AuthCredentials): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(credentials);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthForm mode="login" isSubmitting={isSubmitting} error={error} onSubmit={handleLogin} />
    </AuthLayout>
  );
}