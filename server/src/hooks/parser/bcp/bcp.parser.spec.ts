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

  describe('canParse', () => {
    const base = loadFixture('bcp-consumo');
    const withSubject = (subject: string, body = 'sin datos') => ({
      ...base,
      subject,
      body,
    });

    it.each([
      'Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP',
      'Fwd: Realizaste un consumo con tu Tarjeta de Crédito BCP - Servicio de Notificaciones BCP',
    ])('accepts consumption subject: %s', (subject) => {
      expect(parser.canParse(withSubject(subject))).toBe(true);
    });

    it('accepts a consumption body even when the subject differs', () => {
      const email = withSubject(
        'Otro asunto',
        'Operación realizada *Consumo Tarjeta de Débito*',
      );

      expect(parser.canParse(email)).toBe(true);
    });

    it.each([
      'Constancia de Transferencia a cuentas propias o a terceros - BCP',
      'ENVIO AUTOMATICO - CONSTANCIA DE PAGO DE SERVICIO - BANCA POR INTERNET BCP',
    ])('rejects non-consumption operation: %s', (subject) => {
      expect(parser.canParse(withSubject(subject))).toBe(false);
    });
  });

  it('parses a debit card consumption email, including the card number', () => {
    const email = loadFixture('bcp-consumo-debito');

    expect(parser.canParse(email)).toBe(true);
    expect(parser.parse(email)).toMatchObject({
      operationType: 'DEBIT',
      operationDescription: 'Consumo Tarjeta de Débito',
      cardLastFour: '2468',
    });
  });

  it.each(['skipped/bcp-transferencia', 'skipped/bcp-pago-servicio'])(
    'skips a non-consumption operation: %s',
    (name) => {
      expect(parser.canParse(loadFixture(name))).toBe(false);
    },
  );

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

  it('maps operationType to UNKNOWN when neither card type matches', () => {
    const email = {
      ...loadFixture('bcp-consumo'),
      body: loadFixture('bcp-consumo').body.replace(
        /Tarjeta de Crédito BCP/g,
        'Tarjeta Prepago BCP',
      ),
    };

    expect(parser.parse(email).operationType).toBe('UNKNOWN');
  });

  it('does not claim an unrelated email', () => {
    const email = {
      ...loadFixture('bcp-consumo'),
      subject: 'Hello there',
      body: 'nothing relevant',
    };

    expect(parser.canParse(email)).toBe(false);
  });

  it('throws ParseError when a required field is missing', () => {
    const email = {
      ...loadFixture('bcp-consumo'),
      body: 'Realizaste un consumo pero el cuerpo esta incompleto',
    };

    expect(() => parser.parse(email)).toThrow(ParseError);
  });

  it('throws ParseError on a malformed email missing the merchant field', () => {
    const email = loadFixture('failed/bcp-missing-merchant');

    expect(() => parser.parse(email)).toThrow(ParseError);
  });
});
