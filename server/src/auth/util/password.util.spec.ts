import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.util.js';

describe('password.util', () => {
  it('verifies the password it hashed', async () => {
    const hash = await hashPassword('correct-horse');

    expect(await verifyPassword('correct-horse', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse');

    expect(await verifyPassword('wrong-horse', hash)).toBe(false);
  });

  it('returns false for a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});
