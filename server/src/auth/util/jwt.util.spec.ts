import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  resolveJwtSecret,
  signAuthToken,
  verifyAuthToken,
} from './jwt.util.js';

describe('resolveJwtSecret', () => {
  it('throws in production when JWT_SECRET is missing', () => {
    expect(() => resolveJwtSecret('production', undefined)).toThrow(
      /JWT_SECRET/,
    );
  });

  it('falls back to a dev secret only in development', () => {
    expect(resolveJwtSecret('development', undefined)).toBe(
      'dev-only-secret-change-me',
    );
  });

  it('throws in staging when JWT_SECRET is missing', () => {
    expect(() => resolveJwtSecret('staging', undefined)).toThrow(/JWT_SECRET/);
  });

  it('throws when APP_ENV is unset and JWT_SECRET is missing', () => {
    expect(() => resolveJwtSecret(undefined, undefined)).toThrow(/JWT_SECRET/);
  });

  it('rejects a short secret outside development', () => {
    expect(() => resolveJwtSecret('production', 'too-short')).toThrow(
      /at least 32/,
    );
  });

  it('uses a long enough secret outside development', () => {
    const secret = 'a'.repeat(32);
    expect(resolveJwtSecret('production', secret)).toBe(secret);
  });

  it('accepts a short explicit secret in development', () => {
    expect(resolveJwtSecret('development', 'short')).toBe('short');
  });
});

describe('jwt.util', () => {
  it('verifies a token signed with the same payload', () => {
    const token = signAuthToken({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
    });

    const payload = verifyAuthToken(token);

    expect(payload).toEqual({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
    });
  });

  it('rejects a tampered token', () => {
    const token = signAuthToken({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
    });

    const payload = verifyAuthToken(`${token}tampered`);

    expect(payload).toBeNull();
  });

  it('rejects a token signed with a non-HS256 algorithm', () => {
    const token = jwt.sign(
      { id: 'user-1', role: 'ADMIN', email: 'javier@example.com' },
      'dev-only-secret-change-me',
      { algorithm: 'HS512' },
    );

    expect(verifyAuthToken(token)).toBeNull();
  });
});
