import { describe, expect, it, vi } from 'vitest';
import type { AlertEvent } from '../push/push.service.js';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import type { StoreResult } from './email-notification.repository.js';
import { HooksService } from './hooks.service.js';
import {
  type BankParser,
  type ParsedTransaction,
  ParseError,
} from './parser/parser.interface.js';

const email = { messageId: 'msg-1' } as unknown as GmailWebhookDto;

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

function makeParser(parse: BankParser['parse'] = () => parsed): BankParser {
  return { name: 'test-parser', canParse: () => true, parse };
}

const alertEvent: AlertEvent = {
  type: 'transaction',
  id: 'txn-1',
  merchant: 'Store',
  amount: '10.00',
  currency: 'PEN',
};

function makeService(
  parser: BankParser | null,
  result: StoreResult = { status: 'created', event: null },
) {
  const repository = { store: vi.fn().mockResolvedValue(result) };
  const registry = { find: vi.fn().mockReturnValue(parser) };
  const push = { notify: vi.fn().mockResolvedValue(undefined) };
  const service = new HooksService(
    repository as any,
    registry as any,
    push as any,
  );
  return { service, repository, push };
}

describe('HooksService', () => {
  it('stores the parsed transaction under the matched parser', async () => {
    const { service, repository } = makeService(makeParser());

    await service.receiveEmail('user-1', email);

    expect(repository.store).toHaveBeenCalledWith('user-1', email, {
      parserName: 'test-parser',
      parsed,
    });
  });

  it('stores a null outcome (UNPARSED) when no parser matches', async () => {
    const { service, repository } = makeService(null);

    await service.receiveEmail('user-1', email);

    expect(repository.store).toHaveBeenCalledWith('user-1', email, null);
  });

  it('stores a failed outcome when parsing throws a ParseError', async () => {
    const parser = makeParser(() => {
      throw new ParseError('bad format');
    });
    const { service, repository } = makeService(parser);

    await service.receiveEmail('user-1', email);

    expect(repository.store).toHaveBeenCalledWith('user-1', email, {
      parserName: 'test-parser',
      parsed: null,
    });
  });

  it('propagates unexpected parser errors without storing', async () => {
    const parser = makeParser(() => {
      throw new Error('boom');
    });
    const { service, repository } = makeService(parser);

    await expect(service.receiveEmail('user-1', email)).rejects.toThrow('boom');
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('resolves normally on duplicate delivery', async () => {
    const { service } = makeService(makeParser(), { status: 'duplicate' });

    await expect(
      service.receiveEmail('user-1', email),
    ).resolves.toBeUndefined();
  });

  it('pushes the stored event to the user after the commit', async () => {
    const { service, push } = makeService(makeParser(), {
      status: 'created',
      event: alertEvent,
    });

    await service.receiveEmail('user-1', email);

    expect(push.notify).toHaveBeenCalledWith('user-1', alertEvent);
  });

  it('pushes nothing when the stored email raises no alert', async () => {
    const { service, push } = makeService(null);

    await service.receiveEmail('user-1', email);

    expect(push.notify).not.toHaveBeenCalled();
  });

  it('pushes nothing on duplicate delivery', async () => {
    const { service, push } = makeService(makeParser(), {
      status: 'duplicate',
    });

    await service.receiveEmail('user-1', email);

    expect(push.notify).not.toHaveBeenCalled();
  });
});
