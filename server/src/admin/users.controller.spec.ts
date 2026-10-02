import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../auth/util/password.util.js';
import { UsersController } from './users.controller.js';

function requestWithUser(id: string): FastifyRequest {
  return { user: { id, role: 'ADMIN', email: 'admin@example.com' } } as any;
}

function duplicateEmailError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

describe('UsersController', () => {
  describe('createUser', () => {
    it('creates a user with a hashed password', async () => {
      const prisma = {
        user: {
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: 'user-2',
              email: data.email,
              role: data.role,
              createdAt: new Date(),
            }),
          ),
        },
      };
      const controller = new UsersController(prisma as any);

      const result = await controller.createUser({
        email: 'new@example.com',
        password: 'password123',
        role: 'USER',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(verifyPassword('password123', createArgs.data.passwordHash)).toBe(
        true,
      );
      expect(result).toEqual({
        id: 'user-2',
        email: 'new@example.com',
        role: 'USER',
        createdAt: expect.any(Date),
      });
    });

    it('rejects a duplicate email', async () => {
      const prisma = {
        user: { create: vi.fn().mockRejectedValue(duplicateEmailError()) },
      };
      const controller = new UsersController(prisma as any);

      await expect(
        controller.createUser({
          email: 'dup@example.com',
          password: 'password123',
          role: 'USER',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateUser', () => {
    it('updates the role, excluding the requesting admin', async () => {
      const prisma = {
        user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const controller = new UsersController(prisma as any);

      await controller.updateUser(requestWithUser('admin-1'), 'user-2', {
        role: 'ADMIN',
      });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-2', NOT: { id: 'admin-1' } },
        data: { role: 'ADMIN' },
      });
    });

    it('throws NotFoundException when no row matched', async () => {
      const prisma = {
        user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      const controller = new UsersController(prisma as any);

      await expect(
        controller.updateUser(requestWithUser('admin-1'), 'user-2', {
          role: 'ADMIN',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('deletes the user, excluding the requesting admin', async () => {
      const prisma = {
        user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const controller = new UsersController(prisma as any);

      await controller.deleteUser(requestWithUser('admin-1'), 'user-2');

      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: 'user-2', NOT: { id: 'admin-1' } },
      });
    });

    it('throws NotFoundException when no row matched', async () => {
      const prisma = {
        user: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      const controller = new UsersController(prisma as any);

      await expect(
        controller.deleteUser(requestWithUser('admin-1'), 'user-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
