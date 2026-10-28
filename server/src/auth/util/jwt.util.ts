import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '../types/auth.types.js';

export const SESSION_MAX_AGE_SECONDS = 15 * 24 * 60 * 60;
const ALGORITHM = 'HS256';

export function signAuthToken(
  payload: AuthTokenPayload,
  secret: string,
): string {
  return jwt.sign(payload, secret, {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    algorithm: ALGORITHM,
  });
}

export function verifyAuthToken(
  token: string,
  secret: string,
): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    if (
      typeof decoded !== 'object' ||
      typeof decoded.id !== 'string' ||
      typeof decoded.role !== 'string' ||
      typeof decoded.email !== 'string'
    ) {
      return null;
    }
    return { id: decoded.id, role: decoded.role, email: decoded.email };
  } catch {
    return null;
  }
}

// Sliding session: the caller has already verified the token; once less than
// half of its life is left, the guard hands out a fresh one.
export function shouldRefreshAuthToken(
  token: string,
  now = Date.now(),
): boolean {
  const decoded = jwt.decode(token);
  if (typeof decoded !== 'object' || typeof decoded?.exp !== 'number') {
    return false;
  }
  const remainingSeconds = decoded.exp - now / 1000;
  return remainingSeconds < SESSION_MAX_AGE_SECONDS / 2;
}
