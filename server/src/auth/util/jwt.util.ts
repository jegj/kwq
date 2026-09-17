import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '../types/auth.types.js';

const SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
const EXPIRES_IN = '7d';

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
