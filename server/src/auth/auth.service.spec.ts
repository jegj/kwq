import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { hashPassword } from './util/password.util.js';

function makePrismaStub(user: unknown) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  };
}

describe('AuthService', () => {
  it('returns the user id and role for correct credentials', async () => {
    const prisma = makePrismaStub({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
      passwordHash: hashPassword('correct-horse'),
    });
    const authService = new AuthService(prisma as any);

    const result = await authService.validateUser(
      'javier@example.com',
      'correct-horse',
    );

    expect(result).toEqual({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
    });
  });

  it('returns null for an unknown email', async () => {
    const prisma = makePrismaStub(null);
    const authService = new AuthService(prisma as any);

    const result = await authService.validateUser(
      'nobody@example.com',
      'whatever',
    );

    expect(result).toBeNull();
  });

  it('returns null for the wrong password', async () => {
    const prisma = makePrismaStub({
      id: 'user-1',
      role: 'ADMIN',
      passwordHash: hashPassword('correct-horse'),
    });
    const authService = new AuthService(prisma as any);

    const result = await authService.validateUser(
      'javier@example.com',
      'wrong-password',
    );

    expect(result).toBeNull();
  });
});
