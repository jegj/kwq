export interface AuthTokenPayload {
  id: string;
  role: string;
  email: string;
}

export type AuthenticatedUser = AuthTokenPayload;
