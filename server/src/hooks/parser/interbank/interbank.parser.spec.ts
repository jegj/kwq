import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GmailWebhookDto } from '../../dto/email-webhook.dto.js';
import { ParseError } from '../parser.interface.js';
import { InterbankParser } from './interbank.parser.js';

function loadFixture(name: string): GmailWebhookDto {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('InterbankParser', () => {
  const parser = new InterbankParser();

  it('parses a USD card consumption email', () => {
    const email = loadFixture('interbank-consumo-usd');

    expect(parser.canParse(email)).toBe(true);
    expect(parser.parse(email)).toEqual({
      amount: '1.00',
      currency: 'USD',
      merchant: 'AMAZON WEB SERVICES',
      operationDescription: null,
      operationType: 'UNKNOWN',
      operationNumber: null,
      cardLastFour: '215',
      transactionDate: new Date('2026-10-01T21:14:00.000Z'),
    });
  });

  it('parses a PEN (S/) amount', () => {
    const email = loadFixture('interbank-consumo-usd');
    const body = email.body.replace('Monto: $ 1.00', 'Monto: S/ 1,234.50');

    const transaction = parser.parse({ ...email, body });

    expect(transaction.currency).toBe('PEN');
    expect(transaction.amount).toBe('1234.50');
  });

  it('does not claim an unrelated email', () => {
    const email = { ...loadFixture('interbank-consumo-usd'), from: 'a@b.com' };

    expect(parser.canParse(email)).toBe(false);
  });

  it('throws ParseError when a required field is missing', () => {
    const email = { ...loadFixture('interbank-consumo-usd'), body: 'nope' };

    expect(() => parser.parse(email)).toThrow(ParseError);
  });
});
