import { describe, expect, it, vi } from 'vitest';
import { EmailsRepository } from './emails.repository.js';

const UUID = (n: number) =>
  `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`;

function repositoryWith() {
  const prisma = {
    emailNotification: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  return { prisma, repository: new EmailsRepository(prisma as any) };
}

describe('EmailsRepository', () => {
  describe('findPage', () => {
    it('scopes to the user, newest first, with the requested take and list columns', async () => {
      const { prisma, repository } = repositoryWith();

      await repository.findPage('user-1', {}, {}, 21);

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
        select: {
          id: true,
          parserName: true,
          parseStatus: true,
          messageId: true,
          transactionId: true,
          createdAt: true,
        },
      });
    });

    it('adds the (createdAt, id) keyset condition for a before cursor', async () => {
      const { prisma, repository } = repositoryWith();
      const date = new Date('2026-09-25T00:00:00.000Z');

      await repository.findPage(
        'user-1',
        {},
        { before: { date, id: UUID(5) } },
        21,
      );

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            OR: [
              { createdAt: { lt: date } },
              { createdAt: date, id: { lt: UUID(5) } },
            ],
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('queries ascending with a gt condition for an after cursor', async () => {
      const { prisma, repository } = repositoryWith();
      const date = new Date('2026-09-25T00:00:00.000Z');

      await repository.findPage(
        'user-1',
        {},
        { after: { date, id: UUID(5) } },
        21,
      );

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            OR: [
              { createdAt: { gt: date } },
              { createdAt: date, id: { gt: UUID(5) } },
            ],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('combines month, status and parser filters', async () => {
      const { prisma, repository } = repositoryWith();
      const month = { gte: new Date(0), lt: new Date(1) };

      await repository.findPage(
        'user-1',
        { month, status: 'FAILED', parserName: 'bcp' },
        {},
        21,
      );

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            createdAt: month,
            parseStatus: 'FAILED',
            parserName: 'bcp',
          },
        }),
      );
    });
  });

  it('findById only matches the user’s own email and loads the full body', async () => {
    const { prisma, repository } = repositoryWith();

    await repository.findById(UUID(1), 'user-1');

    expect(prisma.emailNotification.findFirst).toHaveBeenCalledWith({
      where: { id: UUID(1), userId: 'user-1' },
      select: expect.objectContaining({
        subject: true,
        body: true,
        bodyHtml: true,
      }),
    });
  });
});
