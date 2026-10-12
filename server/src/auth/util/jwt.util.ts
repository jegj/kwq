import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '../types/auth.types.js';

const EXPIRES_IN = '7d';
const ALGORITHM = 'HS256';
const MIN_SECRET_LENGTH = 32;

export function resolveJwtSecret(
  appEnv: string | undefined,
  jwtSecret: string | undefined,
): string {
  if (appEnv === 'development') {
    return jwtSecret || 'dev-only-secret-change-me';
  }
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set unless APP_ENV=development');
  }
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters outside development`,
    );
  }
  return jwtSecret;
}

const SECRET = resolveJwtSecret(process.env.APP_ENV, process.env.JWT_SECRET);

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: EXPIRES_IN,
    algorithm: ALGORITHM,
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
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
