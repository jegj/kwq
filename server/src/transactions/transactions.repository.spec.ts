import { describe, expect, it, vi } from 'vitest';
import { TransactionsRepository } from './transactions.repository.js';

const UUID = (n: number) =>
  `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`;

function repositoryWith() {
  const prisma = {
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: UUID(1) }),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, repository: new TransactionsRepository(prisma as any) };
}

describe('TransactionsRepository', () => {
  describe('findPage', () => {
    it('scopes to the user, newest first, with the requested take', async () => {
      const { prisma, repository } = repositoryWith();

      await repository.findPage('user-1', {}, {}, 21);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          take: 21,
        }),
      );
    });

    it('orders ascending when paging towards newer rows', async () => {
      const { prisma, repository } = repositoryWith();

      await repository.findPage(
        'user-1',
        {},
        { after: { date: new Date(0), id: UUID(5) } },
        21,
      );

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('adds the (transactionDate, id) keyset condition for a before cursor', async () => {
      const { prisma, repository } = repositoryWith();
      const date = new Date('2026-09-25T00:00:00.000Z');

      await repository.findPage(
        'user-1',
        {},
        { before: { date, id: UUID(5) } },
        21,
      );

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            OR: [
              { transactionDate: { lt: date } },
              { transactionDate: date, id: { lt: UUID(5) } },
            ],
          },
        }),
      );
    });

    it('restricts to the month by transaction date', async () => {
      const { prisma, repository } = repositoryWith();
      const month = { gte: new Date(0), lt: new Date(1) };

      await repository.findPage('user-1', { month }, {}, 21);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', transactionDate: month },
        }),
      );
    });

    it.each([
      ['a category', { categoryId: UUID(9) }, { categoryId: UUID(9) }],
      ['no category', { categoryId: null }, { categoryId: null }],
      [
        'a parser',
        { source: { parserName: 'bcp' } },
        { email: { is: { parserName: 'bcp' } } },
      ],
      ['manual entry', { source: null }, { email: { is: null } }],
    ])('filters by %s', async (_name, filters, expected) => {
      const { prisma, repository } = repositoryWith();

      await repository.findPage('user-1', filters, {}, 21);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', ...expected } }),
      );
    });
  });

  it('findById only matches the user’s own transaction', async () => {
    const { prisma, repository } = repositoryWith();

    await repository.findById(UUID(1), 'user-1');

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: UUID(1), userId: 'user-1' } }),
    );
  });

  it('findCategoryId only matches the user’s own transaction', async () => {
    const { prisma, repository } = repositoryWith();
    prisma.transaction.findFirst.mockResolvedValue({ categoryId: UUID(9) });

    const result = await repository.findCategoryId(UUID(1), 'user-1');

    expect(result).toEqual({ categoryId: UUID(9) });
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: UUID(1), userId: 'user-1' },
      select: { categoryId: true },
    });
  });

  it('create returns only the new id', async () => {
    const { prisma, repository } = repositoryWith();
    const data = { userId: 'user-1', merchant: 'Shop' } as any;

    const result = await repository.create(data);

    expect(result).toEqual({ id: UUID(1) });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data,
      select: { id: true },
    });
  });

  it('update targets only the user’s transaction', async () => {
    const { prisma, repository } = repositoryWith();

    await repository.update(UUID(1), 'user-1', { merchant: 'Shop' });

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: UUID(1), userId: 'user-1' },
      data: { merchant: 'Shop' },
    });
  });

  describe('delete', () => {
    it('deletes only the user’s transaction and reports it', async () => {
      const { prisma, repository } = repositoryWith();

      expect(await repository.delete(UUID(1), 'user-1')).toBe(true);
      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: { id: UUID(1), userId: 'user-1' },
      });
    });

    it('reports false when nothing was deleted', async () => {
      const { prisma, repository } = repositoryWith();
      prisma.transaction.deleteMany.mockResolvedValue({ count: 0 });

      expect(await repository.delete(UUID(1), 'user-1')).toBe(false);
    });
  });
});
