import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CategoryNameTakenError } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';

function serviceWith() {
  const repository = {
    findVisible: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Gym' }),
    updateOwn: vi.fn().mockResolvedValue(true),
    deleteOwn: vi.fn().mockResolvedValue(true),
  };
  return { repository, service: new CategoriesService(repository as any) };
}

describe('CategoriesService', () => {
  it('list flags only the user’s own categories and hides the owner id', async () => {
    const { repository, service } = serviceWith();
    repository.findVisible.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Comida',
        icon: '🍔',
        color: '#ff0000',
        userId: null,
      },
      { id: 'cat-2', name: 'Gym', icon: null, color: null, userId: 'user-1' },
      { id: 'cat-3', name: 'Other', icon: null, color: null, userId: 'user-2' },
    ]);

    const result = await service.list('user-1');

    expect(repository.findVisible).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
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

  describe('create', () => {
    it('creates the category for the user', async () => {
      const { repository, service } = serviceWith();

      const result = await service.create('user-1', { name: 'Gym' });

      expect(result).toEqual({ id: 'cat-1', name: 'Gym' });
      expect(repository.create).toHaveBeenCalledWith('user-1', { name: 'Gym' });
    });

    it('turns a taken name into a Conflict', async () => {
      const { repository, service } = serviceWith();
      repository.create.mockRejectedValue(new CategoryNameTakenError());

      await expect(service.create('user-1', { name: 'Gym' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows other errors', async () => {
      const { repository, service } = serviceWith();
      repository.create.mockRejectedValue(new Error('boom'));

      await expect(service.create('user-1', { name: 'Gym' })).rejects.toThrow(
        'boom',
      );
    });
  });

  describe('update', () => {
    it('updates the user’s own category', async () => {
      const { repository, service } = serviceWith();

      await service.update('user-1', 'cat-2', { name: 'Gym' });

      expect(repository.updateOwn).toHaveBeenCalledWith('cat-2', 'user-1', {
        name: 'Gym',
      });
    });

    it('throws NotFound for a global or foreign category', async () => {
      const { repository, service } = serviceWith();
      repository.updateOwn.mockResolvedValue(false);

      await expect(
        service.update('user-1', 'cat-1', { name: 'Gym' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('turns a colliding rename into a Conflict', async () => {
      const { repository, service } = serviceWith();
      repository.updateOwn.mockRejectedValue(new CategoryNameTakenError());

      await expect(
        service.update('user-1', 'cat-2', { name: 'Gym' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes the user’s own category', async () => {
      const { repository, service } = serviceWith();

      await service.remove('user-1', 'cat-2');

      expect(repository.deleteOwn).toHaveBeenCalledWith('cat-2', 'user-1');
    });

    it('throws NotFound for a global or foreign category', async () => {
      const { repository, service } = serviceWith();
      repository.deleteOwn.mockResolvedValue(false);

      await expect(service.remove('user-1', 'cat-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
