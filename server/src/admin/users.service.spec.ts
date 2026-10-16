import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../auth/util/password.util.js';
import { EmailTakenError } from './users.repository.js';
import { UsersService } from './users.service.js';

function serviceWith() {
  const repository = {
    findAllExcept: vi.fn().mockResolvedValue([{ id: 'user-2' }]),
    create: vi.fn().mockResolvedValue({ id: 'user-3' }),
    updateRoleExcept: vi.fn().mockResolvedValue(true),
    deleteExcept: vi.fn().mockResolvedValue(true),
  };
  return { repository, service: new UsersService(repository as any) };
}

const newUser = {
  email: 'new@example.com',
  password: 'password123',
  role: 'USER' as const,
};

describe('UsersService', () => {
  it('list returns everyone except the acting admin', async () => {
    const { repository, service } = serviceWith();

    expect(await service.list('admin-1')).toEqual([{ id: 'user-2' }]);
    expect(repository.findAllExcept).toHaveBeenCalledWith('admin-1');
  });

  describe('create', () => {
    it('stores a hash of the password, never the password itself', async () => {
      const { repository, service } = serviceWith();

      const result = await service.create(newUser);

      expect(result).toEqual({ id: 'user-3' });
      const [data] = repository.create.mock.calls[0];
      expect(data).toMatchObject({ email: 'new@example.com', role: 'USER' });
      expect(data.password).toBeUndefined();
      expect(await verifyPassword('password123', data.passwordHash)).toBe(true);
    });

    it('turns a taken email into a Conflict', async () => {
      const { repository, service } = serviceWith();
      repository.create.mockRejectedValue(new EmailTakenError());

      await expect(service.create(newUser)).rejects.toThrow(ConflictException);
    });

    it('rethrows other errors', async () => {
      const { repository, service } = serviceWith();
      repository.create.mockRejectedValue(new Error('boom'));

      await expect(service.create(newUser)).rejects.toThrow('boom');
    });
  });

  describe('updateRole', () => {
    it('updates the role of someone other than the acting admin', async () => {
      const { repository, service } = serviceWith();

      await service.updateRole('admin-1', 'user-2', { role: 'ADMIN' });

      expect(repository.updateRoleExcept).toHaveBeenCalledWith(
        'user-2',
        'admin-1',
        'ADMIN',
      );
    });

    it('throws NotFound when nobody matched', async () => {
      const { repository, service } = serviceWith();
      repository.updateRoleExcept.mockResolvedValue(false);

      await expect(
        service.updateRole('admin-1', 'user-2', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes someone other than the acting admin', async () => {
      const { repository, service } = serviceWith();

      await service.remove('admin-1', 'user-2');

      expect(repository.deleteExcept).toHaveBeenCalledWith('user-2', 'admin-1');
    });

    it('throws NotFound when nobody matched', async () => {
      const { repository, service } = serviceWith();
      repository.deleteExcept.mockResolvedValue(false);

      await expect(service.remove('admin-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
