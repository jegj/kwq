import { describe, expect, it, vi } from 'vitest';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
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

function makeService(
  parser: BankParser | null,
  result: 'created' | 'duplicate' = 'created',
) {
  const repository = { store: vi.fn().mockResolvedValue(result) };
  const registry = { find: vi.fn().mockReturnValue(parser) };
  const service = new HooksService(repository as any, registry as any);
  return { service, repository };
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
    const { service } = makeService(makeParser(), 'duplicate');

    await expect(
      service.receiveEmail('user-1', email),
    ).resolves.toBeUndefined();
  });
});
