import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { hashPassword, verifyPassword } from './util/password.util.js';

vi.mock('./util/password.util.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./util/password.util.js')>();
  return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
});

function makeRepositoryStub(user: unknown) {
  return {
    findByEmail: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
    recordActivity: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService', () => {
  it('returns the user id and role for correct credentials', async () => {
    const repository = makeRepositoryStub({
      id: 'user-1',
      role: 'ADMIN',
      email: 'javier@example.com',
      passwordHash: await hashPassword('correct-horse'),
    });
    const authService = new AuthService(repository as any);

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
    const repository = makeRepositoryStub(null);
    const authService = new AuthService(repository as any);

    const result = await authService.validateUser(
      'nobody@example.com',
      'whatever',
    );

    expect(result).toBeNull();
    expect(repository.recordActivity).not.toHaveBeenCalled();
  });

  it('still verifies a password for an unknown email so timing does not reveal it', async () => {
    vi.mocked(verifyPassword).mockClear();
    const authService = new AuthService(makeRepositoryStub(null) as any);

    await authService.validateUser('nobody@example.com', 'whatever');

    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword).toHaveBeenCalledWith('whatever', expect.any(String));
  });

  it('returns null for the wrong password', async () => {
    const repository = makeRepositoryStub({
      id: 'user-1',
      role: 'ADMIN',
      passwordHash: await hashPassword('correct-horse'),
    });
    const authService = new AuthService(repository as any);

    const result = await authService.validateUser(
      'javier@example.com',
      'wrong-password',
    );

    expect(result).toBeNull();
    expect(repository.recordActivity).toHaveBeenCalledWith(
      'user-1',
      'LOGIN_FAILED',
    );
  });

  it('does not record activity for a successful validation', async () => {
    const repository = makeRepositoryStub({
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
      passwordHash: await hashPassword('correct-horse'),
    });
    const authService = new AuthService(repository as any);

    await authService.validateUser('javier@example.com', 'correct-horse');

    expect(repository.recordActivity).not.toHaveBeenCalled();
  });

  describe('findSessionUser', () => {
    it('returns the current id, role and email from the database', async () => {
      const repository = makeRepositoryStub({
        id: 'user-1',
        role: 'USER',
        email: 'javier@example.com',
        passwordHash: 'x',
      });
      const authService = new AuthService(repository as any);

      const result = await authService.findSessionUser('user-1');

      expect(result).toEqual({
        id: 'user-1',
        role: 'USER',
        email: 'javier@example.com',
      });
      expect(repository.findById).toHaveBeenCalledWith('user-1');
    });

    it('returns null when the user was deleted', async () => {
      const authService = new AuthService(makeRepositoryStub(null) as any);

      expect(await authService.findSessionUser('gone')).toBeNull();
    });
  });
});
