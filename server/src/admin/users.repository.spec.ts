import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EmailTakenError, UsersRepository } from './users.repository.js';

function duplicateEmailError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

function repositoryWith() {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'user-2' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, repository: new UsersRepository(prisma as any) };
}

describe('UsersRepository', () => {
  it('findAllExcept lists everyone but the given user, oldest first', async () => {
    const { prisma, repository } = repositoryWith();

    await repository.findAllExcept('admin-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { not: 'admin-1' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  });

  describe('create', () => {
    const data = {
      email: 'new@example.com',
      role: 'USER' as const,
      passwordHash: 'hash',
    };

    it('creates the user and returns the public fields', async () => {
      const { prisma, repository } = repositoryWith();

      const result = await repository.create(data);

      expect(result).toEqual({ id: 'user-2' });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data,
        select: { id: true, email: true, role: true, createdAt: true },
      });
    });

    it('throws EmailTakenError on a duplicate email', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.create.mockRejectedValue(duplicateEmailError());

      await expect(repository.create(data)).rejects.toThrow(EmailTakenError);
    });

    it('rethrows other errors', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.create.mockRejectedValue(new Error('boom'));

      await expect(repository.create(data)).rejects.toThrow('boom');
    });
  });

  describe('updateRoleExcept', () => {
    it('updates the role, never for the excluded user, and reports it', async () => {
      const { prisma, repository } = repositoryWith();

      expect(
        await repository.updateRoleExcept('user-2', 'admin-1', 'ADMIN'),
      ).toBe(true);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-2', NOT: { id: 'admin-1' } },
        data: { role: 'ADMIN' },
      });
    });

    it('reports false when no user matched', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      expect(
        await repository.updateRoleExcept('user-2', 'admin-1', 'ADMIN'),
      ).toBe(false);
    });
  });

  describe('deleteExcept', () => {
    it('deletes the user, never the excluded one, and reports it', async () => {
      const { prisma, repository } = repositoryWith();

      expect(await repository.deleteExcept('user-2', 'admin-1')).toBe(true);
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: 'user-2', NOT: { id: 'admin-1' } },
      });
    });

    it('reports false when no user matched', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });

      expect(await repository.deleteExcept('user-2', 'admin-1')).toBe(false);
    });
  });
});
