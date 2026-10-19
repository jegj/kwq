import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { signAuthToken, verifyAuthToken } from './jwt.util.js';

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
});
