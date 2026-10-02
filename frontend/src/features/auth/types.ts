export interface AuthUser {
  readonly id: number;
  readonly email: string;
  readonly created_at: string;
}

export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthResponse {
  readonly user: AuthUser;
  readonly access_token: string;
  readonly token_type: string;
}