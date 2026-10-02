import { useState } from "react";
import { useNavigate } from "react-router";
import { AuthForm } from "../components/AuthForm";
import { AuthLayout } from "../components/AuthLayout";
import { getAuthErrorMessage } from "../authErrorMessage";
import { useAuth } from "../hooks/useAuth";
import type { AuthCredentials } from "../types";
import { APP_ROUTES } from "../../../app/routePaths";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(credentials: AuthCredentials): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await signup(credentials);
      navigate(APP_ROUTES.dashboard, { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthForm mode="signup" isSubmitting={isSubmitting} error={error} onSubmit={handleSignup} />
    </AuthLayout>
  );
}