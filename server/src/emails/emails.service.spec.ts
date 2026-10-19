import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { formatCursor } from '../common/pagination.util.js';
import { EmailsService } from './emails.service.js';

const PAGE_SIZE = 20;
const UUID = (n: number) =>
  `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`;

const cursorOf = (row: { createdAt: Date; id: string }) =>
  formatCursor({ date: row.createdAt, id: row.id });

function emailRow(n: number) {
  return {
    id: UUID(n),
    parserName: 'bcp',
    parseStatus: 'PARSED',
    messageId: `msg-${n}`,
    createdAt: new Date(2026, 8, 30 - n),
  };
}

function serviceWith(rows: unknown[] = []) {
  const repository = {
    findPage: vi.fn().mockResolvedValue(rows),
    findById: vi.fn().mockResolvedValue(null),
  };
  const registry = { names: ['bcp', 'interbank', 'falabella'] };
  return {
    repository,
    service: new EmailsService(
      repository as any,
      registry as any,
      { get: () => 'America/Lima' } as any,
    ),
  };
}

const filtersOf = (repository: { findPage: ReturnType<typeof vi.fn> }) =>
  repository.findPage.mock.calls[0][1];

describe('EmailsService', () => {
  describe('list', () => {
    it('asks for one extra row so it knows if another page exists', async () => {
      const { repository, service } = serviceWith([emailRow(1)]);

      const result = await service.list('user-1', {});

      expect(repository.findPage).toHaveBeenCalledWith(
        'user-1',
        {},
        { before: undefined, after: undefined },
        PAGE_SIZE + 1,
      );
      expect(result.emails).toHaveLength(1);
      expect(result.olderCursor).toBeNull();
      expect(result.newerCursor).toBeNull();
    });

    it('offers an older cursor when more rows exist and trims the extra row', async () => {
      const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => emailRow(i));
      const { service } = serviceWith(rows);

      const result = await service.list('user-1', {});

      expect(result.emails).toHaveLength(PAGE_SIZE);
      expect(result.olderCursor).toBe(cursorOf(rows[PAGE_SIZE - 1]));
      expect(result.newerCursor).toBeNull();
    });

    it('passes a parsed before cursor and offers a newer cursor', async () => {
      const cursor = emailRow(5);
      const { repository, service } = serviceWith([emailRow(6)]);

      const result = await service.list('user-1', { before: cursorOf(cursor) });

      expect(repository.findPage.mock.calls[0][2]).toEqual({
        before: { date: cursor.createdAt, id: cursor.id },
        after: undefined,
      });
      expect(result.newerCursor).toBe(cursorOf(emailRow(6)));
    });

    it('restores newest-first order when paging newer', async () => {
      const { service } = serviceWith([emailRow(4), emailRow(3)]);

      const result = await service.list('user-1', {
        after: cursorOf(emailRow(5)),
      });

      expect(result.emails.map((email) => email.id)).toEqual([
        UUID(3),
        UUID(4),
      ]);
      expect(result.olderCursor).toBe(cursorOf(emailRow(4)));
      expect(result.newerCursor).toBeNull();
    });

    it('applies the selected month and keeps it in the view model', async () => {
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

    it('filters by status and parser and keeps them in the view model', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', {
        status: 'FAILED',
        parser: 'bcp',
      });

      expect(filtersOf(repository)).toMatchObject({
        status: 'FAILED',
        parserName: 'bcp',
      });
      expect(result.status).toBe('FAILED');
      expect(result.parser).toBe('bcp');
      expect(result.parsers).toEqual(['bcp', 'interbank', 'falabella']);
    });

    it('ignores an unknown status and an unknown parser', async () => {
      const { repository, service } = serviceWith();

      const result = await service.list('user-1', {
        status: 'foo',
        parser: 'nope',
      });

      expect(filtersOf(repository).status).toBeUndefined();
      expect(filtersOf(repository).parserName).toBeUndefined();
      expect(result.status).toBeNull();
      expect(result.parser).toBeNull();
    });
  });

  describe('get', () => {
    it('returns the email when it belongs to the user', async () => {
      const { repository, service } = serviceWith();
      repository.findById.mockResolvedValue({
        id: UUID(1),
        subject: 'Consumo',
      });

      const result = await service.get('user-1', UUID(1));

      expect(repository.findById).toHaveBeenCalledWith(UUID(1), 'user-1');
      expect(result.subject).toBe('Consumo');
    });

    it('throws NotFound for another user’s or missing email', async () => {
      const { service } = serviceWith();

      await expect(service.get('user-1', UUID(1))).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
