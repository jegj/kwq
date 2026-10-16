import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { formatCursor } from '../common/pagination.util.js';
import { TransactionsService } from './transactions.service.js';

const PAGE_SIZE = 20;
const UUID = (n: number) =>
  `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`;

const cursorOf = (row: { transactionDate: Date; id: string }) =>
  formatCursor({ date: row.transactionDate, id: row.id });

function transactionRow(n: number) {
  return {
    id: UUID(n),
    merchant: `Shop ${n}`,
    amount: '10.50',
    currency: 'PEN',
    operationType: 'DEBIT',
    transactionDate: new Date(2026, 8, 30 - n),
    category: null,
    email: null,
  };
}

const validBody = {
  amount: 10.5,
  currency: 'PEN',
  merchant: 'Shop',
  transactionDate: '2026-09-30T07:00',
} as any;

const registry = { names: ['bcp', 'interbank'] };

function serviceWith(rows: unknown[] = [], categories: { id: string }[] = []) {
  const repository = {
    findPage: vi.fn().mockResolvedValue(rows),
    findById: vi.fn().mockResolvedValue(null),
    findCategoryId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: UUID(1) }),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    findCategories: vi.fn().mockResolvedValue(categories),
    isCategoryAccessible: vi.fn().mockResolvedValue(true),
  };
  return {
    repository,
    service: new TransactionsService(repository as any, registry as any),
  };
}

const filtersOf = (repository: { findPage: ReturnType<typeof vi.fn> }) =>
  repository.findPage.mock.calls[0][1];

describe('TransactionsService', () => {
  describe('list', () => {
    it('asks for one extra row so it knows if another page exists', async () => {
      const { repository, service } = serviceWith([transactionRow(1)]);

      const result = await service.list('user-1', {});

      expect(repository.findPage).toHaveBeenCalledWith(
        'user-1',
        {},
        { before: undefined, after: undefined },
        PAGE_SIZE + 1,
      );
      expect(result.transactions).toHaveLength(1);
      expect(result.olderCursor).toBeNull();
      expect(result.newerCursor).toBeNull();
    });

    it('stringifies amounts for the view', async () => {
      const { service } = serviceWith([
        { ...transactionRow(1), amount: { toString: () => '12.30' } },
      ]);

      const result = await service.list('user-1', {});

      expect(result.transactions[0].amount).toBe('12.30');
    });

    it('offers an older cursor when more rows exist and trims the extra row', async () => {
      const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
        transactionRow(i),
      );
      const { service } = serviceWith(rows);

      const result = await service.list('user-1', {});

      expect(result.transactions).toHaveLength(PAGE_SIZE);
      expect(result.olderCursor).toBe(cursorOf(rows[PAGE_SIZE - 1]));
    });

    it('passes a parsed before cursor to the repository', async () => {
      const cursor = transactionRow(5);
      const { repository, service } = serviceWith([transactionRow(6)]);

      const result = await service.list('user-1', { before: cursorOf(cursor) });

      expect(repository.findPage.mock.calls[0][2]).toEqual({
        before: { date: cursor.transactionDate, id: cursor.id },
        after: undefined,
      });
      expect(result.newerCursor).toBe(cursorOf(transactionRow(6)));
    });

    it('restores newest-first order when paging newer', async () => {
      const { service } = serviceWith([transactionRow(4), transactionRow(3)]);

      const result = await service.list('user-1', {
        after: cursorOf(transactionRow(5)),
      });

      expect(result.transactions.map((row) => row.id)).toEqual([
        UUID(3),
        UUID(4),
      ]);
      expect(result.olderCursor).toBe(cursorOf(transactionRow(4)));
    });

    it('applies the selected month', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', { month: '2026-09' });

      expect(filtersOf(repository).month).toEqual({
        gte: new Date('2026-09-01T05:00:00.000Z'),
        lt: new Date('2026-10-01T05:00:00.000Z'),
      });
      expect(result.month).toBe('2026-09');
    });

    it('ignores a malformed cursor and an invalid month', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', {
        before: 'garbage',
        month: '2026-13',
      });

      expect(filtersOf(repository).month).toBeUndefined();
      expect(repository.findPage.mock.calls[0][2]).toEqual({
        before: undefined,
        after: undefined,
      });
      expect(result.month).toBeNull();
    });

    it('filters by a category the user can see', async () => {
      const { repository, service } = serviceWith([], [{ id: UUID(9) }]);

      const result = await service.list('user-1', { category: UUID(9) });

      expect(filtersOf(repository).categoryId).toBe(UUID(9));
      expect(result.category).toBe(UUID(9));
    });

    it('filters uncategorized transactions with category=none', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', { category: 'none' });

      expect(filtersOf(repository).categoryId).toBeNull();
      expect(result.category).toBe('none');
    });

    it('ignores a category the user cannot see', async () => {
      const { repository, service } = serviceWith([], [{ id: UUID(9) }]);

      const result = await service.list('user-1', { category: UUID(7) });

      expect(filtersOf(repository).categoryId).toBeUndefined();
      expect(result.category).toBeNull();
    });

    it('filters by a registered parser', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', { parser: 'bcp' });

      expect(filtersOf(repository).source).toEqual({ parserName: 'bcp' });
      expect(result.parser).toBe('bcp');
      expect(result.parsers).toEqual(['bcp', 'interbank']);
    });

    it('filters manual transactions with parser=manual', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', { parser: 'manual' });

      expect(filtersOf(repository).source).toBeNull();
      expect(result.parser).toBe('manual');
    });

    it('ignores an unknown parser', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', { parser: 'nope' });

      expect(filtersOf(repository).source).toBeUndefined();
      expect(result.parser).toBeNull();
    });
  });

  describe('get', () => {
    it('returns the transaction with the user’s categories', async () => {
      const { repository, service } = serviceWith([], [{ id: UUID(9) }]);
      repository.findById.mockResolvedValue({
        ...transactionRow(1),
        email: { id: UUID(2) },
      });

      const result = await service.get('user-1', UUID(1));

      expect(repository.findById).toHaveBeenCalledWith(UUID(1), 'user-1');
      expect(result.transaction.email).toEqual({ id: UUID(2) });
      expect(result.categories).toEqual([{ id: UUID(9) }]);
    });

    it('throws NotFound for another user’s or missing transaction', async () => {
      const { service } = serviceWith();

      await expect(service.get('user-1', UUID(1))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates for the user without flagging manual categorization when no category is given', async () => {
      const { repository, service } = serviceWith();

      const result = await service.create('user-1', validBody);

      expect(result).toEqual({ id: UUID(1) });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          merchant: 'Shop',
          transactionDate: new Date('2026-09-30T12:00:00.000Z'),
          isManuallyCategorized: false,
        }),
      );
    });

    it('flags manual categorization when a category is given', async () => {
      const { repository, service } = serviceWith();

      await service.create('user-1', { ...validBody, categoryId: UUID(9) });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: UUID(9),
          isManuallyCategorized: true,
        }),
      );
    });

    it('rejects a category that is neither shared nor the user’s', async () => {
      const { repository, service } = serviceWith();
      repository.isCategoryAccessible.mockResolvedValue(false);

      await expect(
        service.create('user-1', { ...validBody, categoryId: UUID(9) }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.isCategoryAccessible).toHaveBeenCalledWith(
        UUID(9),
        'user-1',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid transaction date', async () => {
      const { repository, service } = serviceWith();

      await expect(
        service.create('user-1', { ...validBody, transactionDate: 'nope' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFound when the transaction is not the user’s', async () => {
      const { repository, service } = serviceWith();

      await expect(
        service.update('user-1', UUID(1), validBody),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('flags manual categorization when the category changed', async () => {
      const { repository, service } = serviceWith();
      repository.findCategoryId.mockResolvedValue({ categoryId: null });

      await service.update('user-1', UUID(1), {
        ...validBody,
        categoryId: UUID(9),
      });

      expect(repository.update).toHaveBeenCalledWith(
        UUID(1),
        expect.objectContaining({
          categoryId: UUID(9),
          isManuallyCategorized: true,
        }),
      );
    });

    it('leaves the flag untouched when the category did not change', async () => {
      const { repository, service } = serviceWith();
      repository.findCategoryId.mockResolvedValue({ categoryId: UUID(9) });

      await service.update('user-1', UUID(1), {
        ...validBody,
        categoryId: UUID(9),
      });

      const [, data] = repository.update.mock.calls[0];
      expect(data.isManuallyCategorized).toBeUndefined();
      expect(repository.isCategoryAccessible).not.toHaveBeenCalled();
    });

    it('allows clearing the category without a lookup', async () => {
      const { repository, service } = serviceWith();
      repository.findCategoryId.mockResolvedValue({ categoryId: UUID(9) });

      await service.update('user-1', UUID(1), {
        ...validBody,
        categoryId: null,
      });

      expect(repository.isCategoryAccessible).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        UUID(1),
        expect.objectContaining({
          categoryId: null,
          isManuallyCategorized: true,
        }),
      );
    });

    it('rejects switching to an inaccessible category', async () => {
      const { repository, service } = serviceWith();
      repository.findCategoryId.mockResolvedValue({ categoryId: null });
      repository.isCategoryAccessible.mockResolvedValue(false);

      await expect(
        service.update('user-1', UUID(1), {
          ...validBody,
          categoryId: UUID(9),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes only the user’s transaction', async () => {
      const { repository, service } = serviceWith();

      await service.remove('user-1', UUID(1));

      expect(repository.delete).toHaveBeenCalledWith(UUID(1), 'user-1');
    });

    it('throws NotFound when nothing was deleted', async () => {
      const { repository, service } = serviceWith();
      repository.delete.mockResolvedValue(false);

      await expect(service.remove('user-1', UUID(1))).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
