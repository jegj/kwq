import { describe, expect, it, vi } from 'vitest';
import { SettingsRepository } from './settings.repository.js';

function repositoryWith() {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma, repository: new SettingsRepository(prisma as any) };
}

describe('SettingsRepository', () => {
  describe('hasWebhookToken', () => {
    it('is false when the user has no token', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.findUnique.mockResolvedValue({ webhookToken: null });

      expect(await repository.hasWebhookToken('user-1')).toBe(false);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { webhookToken: true },
      });
    });

    it('is true when the user has a token', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.findUnique.mockResolvedValue({ webhookToken: 'hashed' });

      expect(await repository.hasWebhookToken('user-1')).toBe(true);
    });

    it('is false when the user is gone', async () => {
      const { repository } = repositoryWith();

      expect(await repository.hasWebhookToken('user-1')).toBe(false);
    });
  });

  describe('setWebhookTokenIfUnset', () => {
    it('only sets a token for a user who has none, and reports it', async () => {
      const { prisma, repository } = repositoryWith();

      expect(await repository.setWebhookTokenIfUnset('user-1', 'hash')).toBe(
        true,
      );
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', webhookToken: null },
        data: { webhookToken: 'hash' },
      });
    });

    it('reports false when a token already exists', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      expect(await repository.setWebhookTokenIfUnset('user-1', 'hash')).toBe(
        false,
      );
    });
  });

  it('findPasswordHash returns the stored hash, or null for a missing user', async () => {
    const { prisma, repository } = repositoryWith();
    prisma.user.findUnique.mockResolvedValue({ passwordHash: 'stored' });

    expect(await repository.findPasswordHash('user-1')).toBe('stored');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { passwordHash: true },
    });

    prisma.user.findUnique.mockResolvedValue(null);
    expect(await repository.findPasswordHash('user-1')).toBeNull();
  });

  it('updatePasswordHash writes the new hash for the user', async () => {
    const { prisma, repository } = repositoryWith();

    await repository.updatePasswordHash('user-1', 'new-hash');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'new-hash' },
    });
  });
});
