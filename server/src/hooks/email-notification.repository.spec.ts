import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { EmailNotificationRepository } from './email-notification.repository.js';
import type { ParsedTransaction } from './parser/parser.interface.js';

const email = {
  messageId: 'msg-1',
  from: 'notifications@bank.com',
  subject: 'Compra',
  body: 'body',
  bodyHtml: null,
  receivedAt: new Date(),
} as unknown as GmailWebhookDto;

const parsed: ParsedTransaction = {
  amount: '10.00',
  currency: 'PEN',
  merchant: 'Store',
  operationDescription: null,
  operationType: 'PURCHASE' as ParsedTransaction['operationType'],
  operationNumber: null,
  cardLastFour: null,
  transactionDate: new Date(),
};

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makePrismaStub(notification: { id: string } | 'duplicate') {
  const tx = {
    emailNotification: {
      create:
        notification === 'duplicate'
          ? vi.fn().mockRejectedValue(uniqueConstraintError())
          : vi.fn().mockResolvedValue(notification),
      update: vi.fn().mockResolvedValue({}),
    },
    transaction: { create: vi.fn().mockResolvedValue({ id: 'txn-1' }) },
  };
  return {
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    emailNotification: { create: vi.fn() },
    _tx: tx,
  };
}

describe('EmailNotificationRepository', () => {
  it('creates the notification, the transaction, and marks it parsed inside one db transaction', async () => {
    const prisma = makePrismaStub({ id: 'notif-1' });
    const repository = new EmailNotificationRepository(prisma as any);

    const result = await repository.store('user-1', email, {
      parserName: 'test-parser',
      parsed,
    });

    expect(result).toBe('created');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.emailNotification.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', messageId: 'msg-1' }),
      }),
    );
    expect(prisma._tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', amount: '10.00' }),
      }),
    );
    expect(prisma._tx.emailNotification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        parseStatus: 'PARSED',
        parserName: 'test-parser',
        transactionId: 'txn-1',
      },
      select: { id: true },
    });
  });

  it('reports a duplicate delivery without touching transaction/update', async () => {
    const prisma = makePrismaStub('duplicate');
    const repository = new EmailNotificationRepository(prisma as any);

    const result = await repository.store('user-1', email, {
      parserName: 'test-parser',
      parsed,
    });

    expect(result).toBe('duplicate');
    expect(prisma._tx.transaction.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.update).not.toHaveBeenCalled();
  });

  it('rethrows non-unique-constraint errors', async () => {
    const prisma = makePrismaStub({ id: 'notif-1' });
    prisma._tx.emailNotification.create.mockRejectedValue(new Error('boom'));
    const repository = new EmailNotificationRepository(prisma as any);

    await expect(repository.store('user-1', email, null)).rejects.toThrow(
      'boom',
    );
  });

  it('creates the notification but skips the update when no parser matched', async () => {
    const prisma = makePrismaStub({ id: 'notif-1' });
    const repository = new EmailNotificationRepository(prisma as any);

    const result = await repository.store('user-1', email, null);

    expect(result).toBe('created');
    expect(prisma._tx.emailNotification.create).toHaveBeenCalled();
    expect(prisma._tx.transaction.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.update).not.toHaveBeenCalled();
  });

  it('marks the notification failed, inside the same transaction, when parsing failed', async () => {
    const prisma = makePrismaStub({ id: 'notif-1' });
    const repository = new EmailNotificationRepository(prisma as any);

    await repository.store('user-1', email, {
      parserName: 'broken-parser',
      parsed: null,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma._tx.transaction.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { parseStatus: 'FAILED', parserName: 'broken-parser' },
      select: { id: true },
    });
  });
});
