import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '../types/auth.types.js';

const EXPIRES_IN = '7d';

export function resolveJwtSecret(
  appEnv: string | undefined,
  jwtSecret: string | undefined,
): string {
  if (jwtSecret) return jwtSecret;
  if (appEnv === 'production') {
    throw new Error('JWT_SECRET must be set when APP_ENV=production');
  }
  return 'dev-only-secret-change-me';
}

const SECRET = resolveJwtSecret(process.env.APP_ENV, process.env.JWT_SECRET);

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
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
