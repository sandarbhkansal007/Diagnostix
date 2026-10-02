import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { validateAuthCredentials, type AuthFieldErrors } from "../authValidation";
import type { AuthCredentials } from "../types";

interface AuthFormProps {
  readonly mode: "login" | "signup";
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly onSubmit: (credentials: AuthCredentials) => Promise<void>;
}

export function AuthForm({ mode, isSubmitting, error, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const isLogin = mode === "login";
  const emailErrorId = "auth-email-error";
  const passwordErrorId = "auth-password-error";

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const credentials = { email: email.trim(), password };
    const errors = validateAuthCredentials(credentials);
    setFieldErrors(errors);

    if (Object.keys(errors).length === 0) {
      void onSubmit(credentials);
    }
  }

  return (
    <>
      <p className="auth-eyebrow">PATIENT ACCESS</p>
      <h1 className="auth-title" id="auth-title">
        {isLogin ? "Welcome back" : "Create your account"}
      </h1>
      <p className="auth-description">
        {isLogin ? "Sign in to continue to Diagnostix." : "Start with your email and a secure password."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            autoComplete="email"
            autoCapitalize="none"
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            disabled={isSubmitting}
            id="auth-email"
            maxLength={254}
            name="email"
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          {fieldErrors.email && (
            <p className="auth-field__error" id={emailErrorId} role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            autoComplete={isLogin ? "current-password" : "new-password"}
            aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
            aria-invalid={Boolean(fieldErrors.password)}
            disabled={isSubmitting}
            id="auth-password"
            maxLength={128}
            minLength={8}
            name="password"
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            placeholder="At least 8 characters"
            required
            type="password"
            value={password}
          />
          {fieldErrors.password && (
            <p className="auth-field__error" id={passwordErrorId} role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {error && (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        )}

        <button className="auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircle className="auth-submit__spinner" size={18} aria-hidden="true" />
          ) : (
            <ArrowRight size={18} aria-hidden="true" />
          )}
          <span>{isSubmitting ? "Please wait" : isLogin ? "Sign in" : "Create account"}</span>
        </button>
      </form>

      <p className="auth-switch">
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <Link to={isLogin ? "/signup" : "/login"}>{isLogin ? "Sign up" : "Sign in"}</Link>
      </p>
    </>
  );
}