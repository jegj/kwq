import { describe, expect, it } from 'vitest';
import { toBankCsv } from './transactions-csv.util.js';

const TIME_ZONE = 'America/Lima';
const BOM = '﻿';

const row = (overrides = {}) => ({
  merchant: 'KFC 070 UNIVERSITARIA',
  amount: '59.90',
  currency: 'PEN',
  operationType: 'DEBIT' as const,
  transactionDate: new Date('2026-11-05T15:00:00Z'),
  ...overrides,
});

const lines = (csv: string) => csv.replace(BOM, '').split('\r\n');

describe('toBankCsv', () => {
  it('starts with a BOM and the bank header, CRLF-terminated', () => {
    const csv = toBankCsv([], TIME_ZONE);

    expect(csv).toBe(`${BOM}Fecha,Descripcion,Moneda,Monto\r\n`);
  });

  it('writes one bank-style row per transaction', () => {
    const csv = toBankCsv([row()], TIME_ZONE);

    expect(lines(csv)[1]).toBe('2026-11-05,KFC 070 UNIVERSITARIA,S/,-59.9');
  });

  it('makes debits negative and credits positive', () => {
    const csv = toBankCsv(
      [row({ operationType: 'CREDIT', amount: '125.00' })],
      TIME_ZONE,
    );

    expect(lines(csv)[1]).toContain(',S/,125');
  });

  it('treats UNKNOWN and missing types as debits', () => {
    const csv = toBankCsv(
      [row({ operationType: 'UNKNOWN' }), row({ operationType: null })],
      TIME_ZONE,
    );

    expect(lines(csv)[1]).toContain(',-59.9');
    expect(lines(csv)[2]).toContain(',-59.9');
  });

  it('maps USD to $ and keeps the ISO code for other currencies', () => {
    const csv = toBankCsv(
      [row({ currency: 'USD' }), row({ currency: 'EUR' })],
      TIME_ZONE,
    );

    expect(lines(csv)[1]).toContain(',$,');
    expect(lines(csv)[2]).toContain(',EUR,');
  });

  it('dates in the app zone, not UTC', () => {
    // 2026-11-06T02:00Z is still Nov 5 in Lima (UTC-5).
    const csv = toBankCsv(
      [row({ transactionDate: new Date('2026-11-06T02:00:00Z') })],
      TIME_ZONE,
    );

    expect(lines(csv)[1].startsWith('2026-11-05,')).toBe(true);
  });

  it('quotes fields with commas, quotes or newlines and doubles quotes', () => {
    const csv = toBankCsv([row({ merchant: 'CAFE "X", SA' })], TIME_ZONE);

    expect(lines(csv)[1]).toContain(',"CAFE ""X"", SA",');
  });

  it('defuses spreadsheet formulas in the description', () => {
    const csv = toBankCsv(
      [row({ merchant: '=HYPERLINK("x")' }), row({ merchant: '-cmd' })],
      TIME_ZONE,
    );

    expect(lines(csv)[1]).toContain(`,"'=HYPERLINK(""x"")",`);
    expect(lines(csv)[2]).toContain(",'-cmd,");
  });

  it('keeps the given row order', () => {
    const csv = toBankCsv(
      [row({ merchant: 'FIRST' }), row({ merchant: 'SECOND' })],
      TIME_ZONE,
    );

    expect(lines(csv)[1]).toContain('FIRST');
    expect(lines(csv)[2]).toContain('SECOND');
  });
});
