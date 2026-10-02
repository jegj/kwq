import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../auth/util/password.util.js';
import { hashWebhookToken } from '../hooks/util/webhook-token.util.js';
import { SettingsController } from './settings.controller.js';

function requestWithUser(id: string): FastifyRequest {
  return { user: { id, role: 'USER', email: 'javier@example.com' } } as any;
}

describe('SettingsController', () => {
  describe('generateWebhookToken', () => {
    it('sets a token for a user who has none yet and returns it once', async () => {
      const prisma = {
        user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const controller = new SettingsController(prisma as any);

      const result = await controller.generateWebhookToken(
        requestWithUser('user-1'),
      );

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', webhookToken: null },
        data: { webhookToken: hashWebhookToken(result.token) },
      });
      expect(result.token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('refuses to overwrite an existing token', async () => {
      const prisma = {
        user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      const controller = new SettingsController(prisma as any);

      await expect(
        controller.generateWebhookToken(requestWithUser('user-1')),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getSettings', () => {
    it('reports no token for a user who has none', async () => {
      const prisma = {
        user: { findUnique: vi.fn().mockResolvedValue({ webhookToken: null }) },
      };
      const controller = new SettingsController(prisma as any);

      const result = await controller.getSettings(requestWithUser('user-1'));

      expect(result.hasWebhookToken).toBe(false);
    });

    it('reports a token for a user who already has one', async () => {
      const prisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ webhookToken: 'hashed' }),
        },
      };
      const controller = new SettingsController(prisma as any);

      const result = await controller.getSettings(requestWithUser('user-1'));

      expect(result.hasWebhookToken).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('updates the password hash when the current password matches', async () => {
      const currentHash = hashPassword('old-password');
      const prisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ passwordHash: currentHash }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      const controller = new SettingsController(prisma as any);

      await controller.changePassword(requestWithUser('user-1'), {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      });
      const newHash = prisma.user.update.mock.calls[0][0].data.passwordHash;
      expect(newHash).not.toBe(currentHash);
    });

    it('rejects when the current password is wrong', async () => {
      const prisma = {
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ passwordHash: hashPassword('old-password') }),
          update: vi.fn(),
        },
      };
      const controller = new SettingsController(prisma as any);

      await expect(
        controller.changePassword(requestWithUser('user-1'), {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
