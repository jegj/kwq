import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  CategoriesRepository,
  CategoryNameTakenError,
} from './categories.repository.js';

function duplicateNameError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

function repositoryWith() {
  const prisma = {
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'cat-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, repository: new CategoriesRepository(prisma as any) };
}

describe('CategoriesRepository', () => {
  it('findVisible returns global and own categories by name, with their owner', async () => {
    const { prisma, repository } = repositoryWith();

    await repository.findVisible('user-1');

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: null }, { userId: 'user-1' }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, icon: true, color: true, userId: true },
    });
  });

  describe('create', () => {
    it('creates the category owned by the user', async () => {
      const { prisma, repository } = repositoryWith();

      const result = await repository.create('user-1', { name: 'Gym' });

      expect(result).toEqual({ id: 'cat-1' });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Gym', userId: 'user-1' },
        select: { id: true, name: true, icon: true, color: true },
      });
    });

    it('throws CategoryNameTakenError on a duplicate name', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.category.create.mockRejectedValue(duplicateNameError());

      await expect(
        repository.create('user-1', { name: 'Gym' }),
      ).rejects.toThrow(CategoryNameTakenError);
    });

    it('rethrows other errors', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.category.create.mockRejectedValue(new Error('boom'));

      await expect(
        repository.create('user-1', { name: 'Gym' }),
      ).rejects.toThrow('boom');
    });
  });

  describe('updateOwn', () => {
    it('updates only the user’s own category and reports it', async () => {
      const { prisma, repository } = repositoryWith();

      const updated = await repository.updateOwn('cat-2', 'user-1', {
        name: 'Gym',
      });

      expect(updated).toBe(true);
      expect(prisma.category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat-2', userId: 'user-1' },
        data: { name: 'Gym' },
      });
    });

    it('reports false for a global or foreign category', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.category.updateMany.mockResolvedValue({ count: 0 });

      expect(
        await repository.updateOwn('cat-2', 'user-1', { name: 'Gym' }),
      ).toBe(false);
    });

    it('throws CategoryNameTakenError on a colliding rename', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.category.updateMany.mockRejectedValue(duplicateNameError());

      await expect(
        repository.updateOwn('cat-2', 'user-1', { name: 'Gym' }),
      ).rejects.toThrow(CategoryNameTakenError);
    });
  });

  describe('deleteOwn', () => {
    it('deletes only the user’s own category and reports it', async () => {
      const { prisma, repository } = repositoryWith();

      expect(await repository.deleteOwn('cat-2', 'user-1')).toBe(true);
      expect(prisma.category.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cat-2', userId: 'user-1' },
      });
    });

    it('reports false when nothing was deleted', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.category.deleteMany.mockResolvedValue({ count: 0 });

      expect(await repository.deleteOwn('cat-2', 'user-1')).toBe(false);
    });
  });
});
