import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../../lib/apiError";
import { clearAccessToken, getAccessToken } from "../../lib/authToken";
import { AuthContext } from "./authContext";
import { getCurrentUser, login as loginUser, logoutSession, signup as signupUser } from "./authService";
import type { AuthCredentials, AuthUser } from "./types";

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (!getAccessToken()) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const restoredUser = await getCurrentUser();
        if (isMounted) {
          setUser(restoredUser);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAccessToken();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  async function login(credentials: AuthCredentials): Promise<void> {
    const response = await loginUser(credentials);
    setUser(response.user);
  }

  async function signup(credentials: AuthCredentials): Promise<void> {
    const response = await signupUser(credentials);
    setUser(response.user);
  }

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (getAccessToken()) {
        await logoutSession();
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        console.warn("Logout request failed; clearing local session anyway.", error);
      }
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
