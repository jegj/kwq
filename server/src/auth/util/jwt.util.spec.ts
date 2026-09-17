import { describe, expect, it } from 'vitest';
import { signAuthToken, verifyAuthToken } from './jwt.util.js';

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
