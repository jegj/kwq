import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { CategoriesController } from './categories.controller.js';

function requestWithUser(id: string): FastifyRequest {
  return { user: { id, role: 'USER', email: 'user@example.com' } } as any;
}

function duplicateNameError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

describe('CategoriesController', () => {
  describe('getCategories', () => {
    it('lists global and own categories, flagging only own ones', async () => {
      const prisma = {
        category: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'cat-1',
              name: 'Comida',
              icon: '🍔',
              color: '#ff0000',
              userId: null,
            },
            {
              id: 'cat-2',
              name: 'Gym',
              icon: null,
              color: null,
              userId: 'user-1',
            },
            {
              id: 'cat-3',
              name: 'Other',
              icon: null,
              color: null,
              userId: 'user-2',
            },
          ]),
        },
      };
      const controller = new CategoriesController(prisma as any);

      const result = await controller.getCategories(requestWithUser('user-1'));

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { OR: [{ userId: null }, { userId: 'user-1' }] },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, icon: true, color: true, userId: true },
      });
      expect(result.page).toBe('./pages/categories');
      expect(result.categories).toEqual([
        {
          id: 'cat-1',
          name: 'Comida',
          icon: '🍔',
          color: '#ff0000',
          isOwnCategory: false,
        },
        {
          id: 'cat-2',
          name: 'Gym',
          icon: null,
          color: null,
          isOwnCategory: true,
        },
        {
          id: 'cat-3',
          name: 'Other',
          icon: null,
          color: null,
          isOwnCategory: false,
        },
      ]);
    });
  });

  describe('createCategory', () => {
    it('creates a category owned by the requesting user', async () => {
      const prisma = {
        category: {
          create: vi
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ id: 'cat-9', ...data }),
            ),
        },
      };
      const controller = new CategoriesController(prisma as any);

      const result = await controller.createCategory(
        requestWithUser('user-1'),
        {
          name: 'Gym',
          icon: '💪',
          color: '#00ff00',
        },
      );

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Gym', icon: '💪', color: '#00ff00', userId: 'user-1' },
        select: { id: true, name: true, icon: true, color: true },
      });
      expect(result).toEqual({
        id: 'cat-9',
        name: 'Gym',
        icon: '💪',
        color: '#00ff00',
        userId: 'user-1',
      });
    });

    it('rejects a duplicate name for the same user', async () => {
      const prisma = {
        category: { create: vi.fn().mockRejectedValue(duplicateNameError()) },
      };
      const controller = new CategoriesController(prisma as any);

      await expect(
        controller.createCategory(requestWithUser('user-1'), { name: 'Gym' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateCategory', () => {
    it("updates only the requesting user's own category", async () => {
      const prisma = {
        category: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const controller = new CategoriesController(prisma as any);

      await controller.updateCategory(requestWithUser('user-1'), 'cat-2', {
        name: 'Fitness',
        icon: '🏋️',
        color: '#0000ff',
      });

      expect(prisma.category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat-2', userId: 'user-1' },
        data: { name: 'Fitness', icon: '🏋️', color: '#0000ff' },
      });
    });

    it('throws NotFoundException for a global or foreign category', async () => {
      const prisma = {
        category: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      const controller = new CategoriesController(prisma as any);

      await expect(
        controller.updateCategory(requestWithUser('user-1'), 'cat-1', {
          name: 'Hacked',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a rename that collides with an existing name', async () => {
      const prisma = {
        category: {
          updateMany: vi.fn().mockRejectedValue(duplicateNameError()),
        },
      };
      const controller = new CategoriesController(prisma as any);

      await expect(
        controller.updateCategory(requestWithUser('user-1'), 'cat-2', {
          name: 'Gym',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deleteCategory', () => {
    it("deletes only the requesting user's own category", async () => {
      const prisma = {
        category: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const controller = new CategoriesController(prisma as any);

      await controller.deleteCategory(requestWithUser('user-1'), 'cat-2');

      expect(prisma.category.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cat-2', userId: 'user-1' },
      });
    });

    it('throws NotFoundException for a global or foreign category', async () => {
      const prisma = {
        category: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      const controller = new CategoriesController(prisma as any);

      await expect(
        controller.deleteCategory(requestWithUser('user-1'), 'cat-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
