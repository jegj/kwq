import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { HooksService } from './hooks.service.js';
import {
  ParseError,
  type BankParser,
  type ParsedTransaction,
} from './parser/parser.interface.js';

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

function makeParser(): BankParser {
  return {
    name: 'test-parser',
    canParse: () => true,
    parse: () => parsed,
  };
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makePrismaStub(options: {
  notification?: { id: string } | 'duplicate';
}) {
  const tx = {
    emailNotification: {
      create:
        options.notification === 'duplicate'
          ? vi.fn().mockRejectedValue(uniqueConstraintError())
          : vi.fn().mockResolvedValue(options.notification ?? { id: 'notif-1' }),
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

function makeParserRegistry(parser: BankParser | null) {
  return { find: vi.fn().mockReturnValue(parser) };
}

describe('HooksService', () => {
  it('creates the notification, the transaction, and marks it parsed inside one db transaction', async () => {
    const prisma = makePrismaStub({ notification: { id: 'notif-1' } });
    const service = new HooksService(
      prisma as any,
      makeParserRegistry(makeParser()) as any,
    );

    await service.receiveEmail('user-1', email);

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
    });
  });

  it('no-ops on duplicate delivery without touching transaction/update', async () => {
    const prisma = makePrismaStub({ notification: 'duplicate' });
    const service = new HooksService(
      prisma as any,
      makeParserRegistry(makeParser()) as any,
    );

    await service.receiveEmail('user-1', email);

    expect(prisma._tx.transaction.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.update).not.toHaveBeenCalled();
  });

  it('creates the notification but skips the update when no parser matches', async () => {
    const prisma = makePrismaStub({ notification: { id: 'notif-1' } });
    const service = new HooksService(
      prisma as any,
      makeParserRegistry(null) as any,
    );

    await service.receiveEmail('user-1', email);

    expect(prisma._tx.emailNotification.create).toHaveBeenCalled();
    expect(prisma._tx.transaction.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.update).not.toHaveBeenCalled();
  });

  it('marks the notification failed, inside the same transaction, when parsing throws', async () => {
    const prisma = makePrismaStub({ notification: { id: 'notif-1' } });
    const parser: BankParser = {
      name: 'broken-parser',
      canParse: () => true,
      parse: () => {
        throw new ParseError('bad format');
      },
    };
    const service = new HooksService(
      prisma as any,
      makeParserRegistry(parser) as any,
    );

    await service.receiveEmail('user-1', email);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma._tx.transaction.create).not.toHaveBeenCalled();
    expect(prisma._tx.emailNotification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { parseStatus: 'FAILED', parserName: 'broken-parser' },
    });
  });
});
