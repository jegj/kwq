import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GmailWebhookDto } from '../../dto/email-webhook.dto.js';
import { ParseError } from '../parser.interface.js';
import { BcpParser } from './bcp.parser.js';

function loadFixture(name: string): GmailWebhookDto {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('BcpParser', () => {
  const parser = new BcpParser();

  it('parses a USD credit card consumption email', () => {
    const email = loadFixture('bcp-consumo');

    expect(parser.canParse(email)).toBe(true);
    const transaction = parser.parse(email);

    expect(transaction).toEqual({
      amount: '59.38',
      currency: 'USD',
      merchant: 'LA FONDA DEL TIO SRL',
      operationDescription: 'Consumo Tarjeta de Crédito',
      operationType: 'CREDIT',
      operationNumber: '0000979366',
      cardLastFour: '2468',
      transactionDate: new Date('2026-09-22T23:45:00.000Z'),
    });
  });

  it('parses a PEN (S/) credit card consumption email', () => {
    const email = loadFixture('bcp-consumo-pen');

    const transaction = parser.parse(email);

    expect(transaction.currency).toBe('PEN');
    expect(transaction.amount).toBe('59.38');
  });

  it('maps operations on a Tarjeta de Débito to DEBIT', () => {
    const email = {
      ...loadFixture('bcp-consumo'),
      body: loadFixture('bcp-consumo').body.replace(
        /Tarjeta de Crédito BCP/g,
        'Tarjeta de Débito BCP',
      ),
    };

    expect(parser.parse(email).operationType).toBe('DEBIT');
  });

  it('does not claim an unrelated email', () => {
    const email = { ...loadFixture('bcp-consumo'), subject: 'Hello there' };

    expect(parser.canParse(email)).toBe(false);
  });

  it('throws ParseError when a required field is missing', () => {
    const email = {
      ...loadFixture('bcp-consumo'),
      body: 'Realizaste un consumo pero el cuerpo esta incompleto',
    };

    expect(() => parser.parse(email)).toThrow(ParseError);
  });
});
