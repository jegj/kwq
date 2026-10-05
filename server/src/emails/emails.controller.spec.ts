import { NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { EmailsController } from './emails.controller.js';
import { formatCursor } from './email-pagination.util.js';

const PAGE_SIZE = 20;
const UUID = (n: number) =>
  `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`;

function requestWithUser(id: string): FastifyRequest {
  return {
    url: '/app/emails',
    user: { id, role: 'USER', email: 'user@example.com' },
  } as any;
}

function emailRow(n: number) {
  return {
    id: UUID(n),
    parserName: 'bcp',
    parseStatus: 'PARSED',
    messageId: `msg-${n}`,
    createdAt: new Date(2026, 8, 30 - n),
  };
}

function controllerWith(rows: unknown[]) {
  const prisma = {
    emailNotification: {
      findMany: vi.fn().mockResolvedValue(rows),
      findFirst: vi.fn(),
    },
  };
  return { prisma, controller: new EmailsController(prisma as any) };
}

describe('EmailsController', () => {
  describe('getEmails', () => {
    it('scopes the first page to the user, newest first, fetching one extra row', async () => {
      const { prisma, controller } = controllerWith([emailRow(1)]);

      const result = await controller.getEmails(requestWithUser('user-1'), {});

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          parserName: true,
          parseStatus: true,
          messageId: true,
          createdAt: true,
        },
      });
      expect(result.page).toBe('./pages/emails');
      expect(result.emails).toHaveLength(1);
      expect(result.olderCursor).toBeNull();
      expect(result.newerCursor).toBeNull();
    });

    it('offers an older cursor when more rows exist and trims the extra row', async () => {
      const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => emailRow(i));
      const { controller } = controllerWith(rows);

      const result = await controller.getEmails(requestWithUser('user-1'), {});

      expect(result.emails).toHaveLength(PAGE_SIZE);
      expect(result.olderCursor).toBe(formatCursor(rows[PAGE_SIZE - 1] as any));
      expect(result.newerCursor).toBeNull();
    });

    it('pages older with a (createdAt, id) keyset condition', async () => {
      const cursor = emailRow(5);
      const { prisma, controller } = controllerWith([emailRow(6)]);

      const result = await controller.getEmails(requestWithUser('user-1'), {
        before: formatCursor(cursor),
      });

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(result.newerCursor).toBe(formatCursor(emailRow(6)));
    });

    it('pages newer by querying ascending and restoring newest-first order', async () => {
      const cursor = emailRow(5);
      const { prisma, controller } = controllerWith([emailRow(4), emailRow(3)]);

      const result = await controller.getEmails(requestWithUser('user-1'), {
        after: formatCursor(cursor),
      });

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(result.emails.map((email) => email.id)).toEqual([
        UUID(3),
        UUID(4),
      ]);
      expect(result.olderCursor).toBe(formatCursor(emailRow(4)));
      expect(result.newerCursor).toBeNull();
    });

    it('restricts to the selected month and keeps it in the view model', async () => {
      const { prisma, controller } = controllerWith([]);

      const result = await controller.getEmails(requestWithUser('user-1'), {
        month: '2026-09',
      });

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            createdAt: {
              gte: new Date('2026-09-01T05:00:00.000Z'),
              lt: new Date('2026-10-01T05:00:00.000Z'),
            },
          },
        }),
      );
      expect(result.month).toBe('2026-09');
    });

    it('combines the month range with the cursor condition', async () => {
      const cursor = emailRow(5);
      const { prisma, controller } = controllerWith([]);

      await controller.getEmails(requestWithUser('user-1'), {
        month: '2026-09',
        before: formatCursor(cursor),
      });

      const { where } = prisma.emailNotification.findMany.mock.calls[0][0];
      expect(where.userId).toBe('user-1');
      expect(where.createdAt).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('ignores a malformed cursor and an invalid month', async () => {
      const { prisma, controller } = controllerWith([]);

      const result = await controller.getEmails(requestWithUser('user-1'), {
        before: 'garbage',
        month: '2026-13',
      });

      expect(prisma.emailNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result.month).toBeNull();
    });
  });

  describe('getEmail', () => {
    it('loads the email only when it belongs to the user', async () => {
      const { prisma, controller } = controllerWith([]);
      prisma.emailNotification.findFirst.mockResolvedValue({
        id: UUID(1),
        subject: 'Consumo',
      });

      const result = await controller.getEmail(
        requestWithUser('user-1'),
        UUID(1),
      );

      expect(prisma.emailNotification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: UUID(1), userId: 'user-1' } }),
      );
      expect(result.page).toBe('./pages/email-detail');
      expect(result.notification.subject).toBe('Consumo');
    });

    it('throws NotFound for another user’s or missing email', async () => {
      const { prisma, controller } = controllerWith([]);
      prisma.emailNotification.findFirst.mockResolvedValue(null);

      await expect(
        controller.getEmail(requestWithUser('user-1'), UUID(1)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
