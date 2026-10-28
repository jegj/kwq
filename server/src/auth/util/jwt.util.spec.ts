import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  SESSION_MAX_AGE_SECONDS,
  shouldRefreshAuthToken,
  signAuthToken,
  verifyAuthToken,
} from './jwt.util.js';

const SECRET = 'test-secret-with-enough-length-for-hs256';

describe('jwt.util', () => {
  it('verifies a token signed with the same payload', () => {
    const token = signAuthToken(
      {
        id: 'user-1',
        role: 'ADMIN',
        email: 'javier@example.com',
      },
      SECRET,
    );

    const payload = verifyAuthToken(token, SECRET);

    expect(payload).toEqual({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
    });
  });

  it('rejects a tampered token', () => {
    const token = signAuthToken(
      {
        id: 'user-1',
        role: 'ADMIN',
        email: 'javier@example.com',
      },
      SECRET,
    );

    const payload = verifyAuthToken(`${token}tampered`, SECRET);

    expect(payload).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAuthToken(
      { id: 'user-1', role: 'ADMIN', email: 'javier@example.com' },
      'another-secret-with-enough-length-12345',
    );

    expect(verifyAuthToken(token, SECRET)).toBeNull();
  });

  it('rejects a token signed with a non-HS256 algorithm', () => {
    const token = jwt.sign(
      { id: 'user-1', role: 'ADMIN', email: 'javier@example.com' },
      SECRET,
      { algorithm: 'HS512' },
    );

    expect(verifyAuthToken(token, SECRET)).toBeNull();
  });

  describe('shouldRefreshAuthToken', () => {
    const token = signAuthToken(
      { id: 'user-1', role: 'ADMIN', email: 'javier@example.com' },
      SECRET,
    );
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('lasts 15 days', () => {
      expect(SESSION_MAX_AGE_SECONDS).toBe(15 * 24 * 60 * 60);
    });

    it('keeps a token that is less than half way through its life', () => {
      expect(shouldRefreshAuthToken(token, Date.now() + 1 * DAY_MS)).toBe(
        false,
      );
    });

    it('refreshes a token that is past half of its life', () => {
      expect(shouldRefreshAuthToken(token, Date.now() + 8 * DAY_MS)).toBe(true);
    });

    it('does not refresh a token without an expiry', () => {
      const noExpiry = jwt.sign({ id: 'user-1' }, SECRET);
      expect(shouldRefreshAuthToken(noExpiry)).toBe(false);
    });
  });
});
