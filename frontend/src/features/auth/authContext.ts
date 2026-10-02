import { createContext } from "react";
import type { AuthCredentials, AuthUser } from "./types";

export interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
  readonly login: (credentials: AuthCredentials) => Promise<void>;
  readonly signup: (credentials: AuthCredentials) => Promise<void>;
  readonly logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);