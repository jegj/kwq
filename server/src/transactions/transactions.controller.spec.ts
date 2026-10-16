import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { formatCursor } from '../common/pagination.util.js';
import { TransactionsController } from './transactions.controller.js';

const PAGE_SIZE = 20;
const UUID = (n: number) =>
  `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`;

function userWith(id: string) {
  return { id, role: 'USER', email: 'user@example.com' };
}

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

function controllerWith(
  rows: unknown[] = [],
  categories: { id: string }[] = [],
) {
  const prisma = {
    transaction: {
      findMany: vi.fn().mockResolvedValue(rows),
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: UUID(1) }),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    category: {
      findMany: vi.fn().mockResolvedValue(categories),
      findFirst: vi.fn().mockResolvedValue({ id: UUID(9) }),
    },
  };
  return {
    prisma,
    controller: new TransactionsController(prisma as any, registry as any),
  };
}

describe('TransactionsController', () => {
  describe('getTransactions', () => {
    it('scopes the first page to the user, newest transaction first, one extra row', async () => {
      const { prisma, controller } = controllerWith([transactionRow(1)]);

      const result = await controller.getTransactions(userWith('user-1'), {});

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          take: PAGE_SIZE + 1,
        }),
      );
      expect(result.page).toBe('./pages/transactions');
      expect(result.transactions).toHaveLength(1);
      expect(result.olderCursor).toBeNull();
      expect(result.newerCursor).toBeNull();
    });

    it('offers an older cursor when more rows exist and trims the extra row', async () => {
      const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
        transactionRow(i),
      );
      const { controller } = controllerWith(rows);

      const result = await controller.getTransactions(userWith('user-1'), {});

      expect(result.transactions).toHaveLength(PAGE_SIZE);
      expect(result.olderCursor).toBe(cursorOf(rows[PAGE_SIZE - 1]));
    });

    it('pages older with a (transactionDate, id) keyset condition', async () => {
      const cursor = transactionRow(5);
      const { prisma, controller } = controllerWith([transactionRow(6)]);

      const result = await controller.getTransactions(userWith('user-1'), {
        before: cursorOf(cursor),
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            OR: [
              { transactionDate: { lt: cursor.transactionDate } },
              {
                transactionDate: cursor.transactionDate,
                id: { lt: cursor.id },
              },
            ],
          },
        }),
      );
      expect(result.newerCursor).toBe(cursorOf(transactionRow(6)));
    });

    it('pages newer by querying ascending and restoring newest-first order', async () => {
      const { prisma, controller } = controllerWith([
        transactionRow(4),
        transactionRow(3),
      ]);

      const result = await controller.getTransactions(userWith('user-1'), {
        after: cursorOf(transactionRow(5)),
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(result.transactions.map((row) => row.id)).toEqual([
        UUID(3),
        UUID(4),
      ]);
      expect(result.olderCursor).toBe(cursorOf(transactionRow(4)));
    });

    it('restricts to the selected month by transaction date', async () => {
      const { prisma, controller } = controllerWith();

      const result = await controller.getTransactions(userWith('user-1'), {
        month: '2026-09',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            transactionDate: {
              gte: new Date('2026-09-01T05:00:00.000Z'),
              lt: new Date('2026-10-01T05:00:00.000Z'),
            },
          },
        }),
      );
      expect(result.month).toBe('2026-09');
    });

    it('ignores a malformed cursor and an invalid month', async () => {
      const { prisma, controller } = controllerWith();

      const result = await controller.getTransactions(userWith('user-1'), {
        before: 'garbage',
        month: '2026-13',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result.month).toBeNull();
    });
    it('filters by a category the user can see', async () => {
      const { prisma, controller } = controllerWith([], [{ id: UUID(9) }]);

      const result = await controller.getTransactions(userWith('user-1'), {
        category: UUID(9),
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', categoryId: UUID(9) },
        }),
      );
      expect(result.category).toBe(UUID(9));
    });

    it('filters uncategorized transactions with category=none', async () => {
      const { prisma, controller } = controllerWith();

      const result = await controller.getTransactions(userWith('user-1'), {
        category: 'none',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', categoryId: null },
        }),
      );
      expect(result.category).toBe('none');
    });

    it('ignores a category the user cannot see', async () => {
      const { prisma, controller } = controllerWith([], [{ id: UUID(9) }]);

      const result = await controller.getTransactions(userWith('user-1'), {
        category: UUID(7),
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result.category).toBeNull();
    });

    it('filters by a registered parser through the source email', async () => {
      const { prisma, controller } = controllerWith();

      const result = await controller.getTransactions(userWith('user-1'), {
        parser: 'bcp',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', email: { is: { parserName: 'bcp' } } },
        }),
      );
      expect(result.parser).toBe('bcp');
      expect(result.parsers).toEqual(['bcp', 'interbank']);
    });

    it('filters manual transactions (no source email) with parser=manual', async () => {
      const { prisma, controller } = controllerWith();

      const result = await controller.getTransactions(userWith('user-1'), {
        parser: 'manual',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', email: { is: null } },
        }),
      );
      expect(result.parser).toBe('manual');
    });

    it('ignores an unknown parser', async () => {
      const { prisma, controller } = controllerWith();

      const result = await controller.getTransactions(userWith('user-1'), {
        parser: 'nope',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result.parser).toBeNull();
    });

    it('combines month, category and parser filters with keyset paging', async () => {
      const { prisma, controller } = controllerWith([], [{ id: UUID(9) }]);
      const cursor = transactionRow(5);

      await controller.getTransactions(userWith('user-1'), {
        month: '2026-09',
        category: UUID(9),
        parser: 'bcp',
        before: cursorOf(cursor),
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            categoryId: UUID(9),
            email: { is: { parserName: 'bcp' } },
            transactionDate: expect.any(Object),
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('getTransaction', () => {
    it('loads the transaction only when it belongs to the user, with its source email id', async () => {
      const { prisma, controller } = controllerWith();
      prisma.transaction.findFirst.mockResolvedValue({
        ...transactionRow(1),
        email: { id: UUID(2) },
      });

      const result = await controller.getTransaction(
        userWith('user-1'),
        UUID(1),
      );

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: UUID(1), userId: 'user-1' } }),
      );
      expect(result.page).toBe('./pages/transaction-detail');
      expect(result.transaction.email).toEqual({ id: UUID(2) });
    });

    it('throws NotFound for another user’s or missing transaction', async () => {
      const { prisma, controller } = controllerWith();
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        controller.getTransaction(userWith('user-1'), UUID(1)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createTransaction', () => {
    it('creates for the user without flagging manual categorization when no category is given', async () => {
      const { prisma, controller } = controllerWith();

      await controller.createTransaction(userWith('user-1'), validBody);

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            merchant: 'Shop',
            transactionDate: new Date('2026-09-30T12:00:00.000Z'),
            isManuallyCategorized: false,
          }),
        }),
      );
    });

    it('flags manual categorization when a category is given', async () => {
      const { prisma, controller } = controllerWith();

      await controller.createTransaction(userWith('user-1'), {
        ...validBody,
        categoryId: UUID(9),
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: UUID(9),
            isManuallyCategorized: true,
          }),
        }),
      );
    });

    it('rejects a category that is neither shared nor the user’s', async () => {
      const { prisma, controller } = controllerWith();
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        controller.createTransaction(userWith('user-1'), {
          ...validBody,
          categoryId: UUID(9),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: UUID(9),
          OR: [{ userId: null }, { userId: 'user-1' }],
        },
        select: { id: true },
      });
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTransaction', () => {
    it('throws NotFound when the transaction is not the user’s', async () => {
      const { prisma, controller } = controllerWith();
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        controller.updateTransaction(userWith('user-1'), UUID(1), validBody),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('flags manual categorization only when the category changed', async () => {
      const { prisma, controller } = controllerWith();
      prisma.transaction.findFirst.mockResolvedValue({ categoryId: null });

      await controller.updateTransaction(userWith('user-1'), UUID(1), {
        ...validBody,
        categoryId: UUID(9),
      });
      expect(prisma.transaction.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: UUID(1) },
          data: expect.objectContaining({
            categoryId: UUID(9),
            isManuallyCategorized: true,
          }),
        }),
      );

      prisma.transaction.findFirst.mockResolvedValue({ categoryId: UUID(9) });
      await controller.updateTransaction(userWith('user-1'), UUID(1), {
        ...validBody,
        categoryId: UUID(9),
      });
      const { data } = prisma.transaction.update.mock.calls[1][0];
      expect(data.isManuallyCategorized).toBeUndefined();
    });

    it('allows clearing the category', async () => {
      const { prisma, controller } = controllerWith();
      prisma.transaction.findFirst.mockResolvedValue({ categoryId: UUID(9) });

      await controller.updateTransaction(userWith('user-1'), UUID(1), {
        ...validBody,
        categoryId: null,
      });

      expect(prisma.category.findFirst).not.toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: null,
            isManuallyCategorized: true,
          }),
        }),
      );
    });
  });

  describe('deleteTransaction', () => {
    it('deletes only the user’s transaction', async () => {
      const { prisma, controller } = controllerWith();

      await controller.deleteTransaction(userWith('user-1'), UUID(1));

      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: { id: UUID(1), userId: 'user-1' },
      });
    });

    it('throws NotFound when nothing was deleted', async () => {
      const { prisma, controller } = controllerWith();
      prisma.transaction.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        controller.deleteTransaction(userWith('user-1'), UUID(1)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
