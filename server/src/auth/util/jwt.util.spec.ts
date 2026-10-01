import { describe, expect, it } from 'vitest';
import { resolveJwtSecret, signAuthToken, verifyAuthToken } from './jwt.util.js';

describe('resolveJwtSecret', () => {
  it('throws in production when JWT_SECRET is missing', () => {
    expect(() => resolveJwtSecret('production', undefined)).toThrow(
      /JWT_SECRET/,
    );
  });

  it('falls back to a dev secret outside production', () => {
    expect(resolveJwtSecret('development', undefined)).toBe(
      'dev-only-secret-change-me',
    );
  });

  it('uses the provided secret when set', () => {
    expect(resolveJwtSecret('production', 'super-secret')).toBe(
      'super-secret',
    );
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
});
