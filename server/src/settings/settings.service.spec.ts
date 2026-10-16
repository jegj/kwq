import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../auth/util/password.util.js';
import { hashWebhookToken } from '../hooks/util/webhook-token.util.js';
import { SettingsService } from './settings.service.js';

function serviceWith() {
  const repository = {
    hasWebhookToken: vi.fn().mockResolvedValue(false),
    setWebhookTokenIfUnset: vi.fn().mockResolvedValue(true),
    findPasswordHash: vi.fn().mockResolvedValue(null),
    updatePasswordHash: vi.fn().mockResolvedValue(undefined),
  };
  return { repository, service: new SettingsService(repository as any) };
}

describe('SettingsService', () => {
  it('hasWebhookToken reflects the repository', async () => {
    const { repository, service } = serviceWith();
    repository.hasWebhookToken.mockResolvedValue(true);

    expect(await service.hasWebhookToken('user-1')).toBe(true);
    expect(repository.hasWebhookToken).toHaveBeenCalledWith('user-1');
  });

  describe('generateWebhookToken', () => {
    it('stores only the hash and returns the plain token once', async () => {
      const { repository, service } = serviceWith();

      const { token } = await service.generateWebhookToken('user-1');

      expect(repository.setWebhookTokenIfUnset).toHaveBeenCalledWith(
        'user-1',
        hashWebhookToken(token),
      );
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('refuses to overwrite an existing token', async () => {
      const { repository, service } = serviceWith();
      repository.setWebhookTokenIfUnset.mockResolvedValue(false);

      await expect(
        service.generateWebhookToken('user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('stores a new hash when the current password matches', async () => {
      const currentHash = await hashPassword('old-password');
      const { repository, service } = serviceWith();
      repository.findPasswordHash.mockResolvedValue(currentHash);

      await service.changePassword('user-1', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });

      const [userId, newHash] = repository.updatePasswordHash.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(newHash).not.toBe(currentHash);
    });

    it('rejects when the current password is wrong', async () => {
      const { repository, service } = serviceWith();
      repository.findPasswordHash.mockResolvedValue(
        await hashPassword('old-password'),
      );

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      const { repository, service } = serviceWith();

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'old-password',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.updatePasswordHash).not.toHaveBeenCalled();
    });
  });
});
