import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GmailWebhookDto } from '../../dto/email-webhook.dto.js';
import { ParseError } from '../parser.interface.js';
import { FalabellaParser } from './falabella.parser.js';

function loadFixture(name: string): GmailWebhookDto {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('FalabellaParser', () => {
  const parser = new FalabellaParser();

  it('parses a PEN CMR consumption email', () => {
    const email = loadFixture('falabella-consumo-pen');

    expect(parser.canParse(email)).toBe(true);
    expect(parser.parse(email)).toEqual({
      amount: '269.10',
      currency: 'PEN',
      merchant: 'Tottus S Miguel Pe',
      operationDescription: null,
      operationType: 'CREDIT',
      operationNumber: '000000004929',
      cardLastFour: '1042',
      transactionDate: new Date('2026-10-02T22:52:00.000Z'),
    });
  });

  it('does not claim an unrelated email', () => {
    const email = { ...loadFixture('falabella-consumo-pen'), from: 'a@b.com' };

    expect(parser.canParse(email)).toBe(false);
  });

  it('throws ParseError when a required field is missing', () => {
    const email = { ...loadFixture('falabella-consumo-pen'), body: 'nope' };

    expect(() => parser.parse(email)).toThrow(ParseError);
  });

  it('throws ParseError on an unknown month name', () => {
    const email = loadFixture('falabella-consumo-pen');
    const body = email.body.replace('octubre', 'foo');

    expect(() => parser.parse({ ...email, body })).toThrow(ParseError);
  });
});
