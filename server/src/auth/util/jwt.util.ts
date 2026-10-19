import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '../types/auth.types.js';

const EXPIRES_IN = '7d';
const ALGORITHM = 'HS256';

export function signAuthToken(
  payload: AuthTokenPayload,
  secret: string,
): string {
  return jwt.sign(payload, secret, {
    expiresIn: EXPIRES_IN,
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
