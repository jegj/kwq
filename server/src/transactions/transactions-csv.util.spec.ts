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
  category: { name: 'Food' } as { name: string } | null,
  ...overrides,
});

const lines = (csv: string) => csv.replace(BOM, '').split('\r\n');

describe('toBankCsv', () => {
  it('starts with a BOM and the bank header, CRLF-terminated', () => {
    const csv = toBankCsv([], TIME_ZONE);

    expect(csv).toBe(`${BOM}Fecha,Descripcion,Moneda,Monto,Categoria,Mes\r\n`);
  });

  it('writes one bank-style row per transaction', () => {
    const csv = toBankCsv([row()], TIME_ZONE);

    expect(lines(csv)[1]).toBe(
      '2026-11-05,KFC 070 UNIVERSITARIA,S/,-59.9,FOOD,11',
    );
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

  it('uppercases the category and leaves it empty when uncategorized', () => {
    const csv = toBankCsv(
      [row({ category: { name: 'Salud y Más' } }), row({ category: null })],
      TIME_ZONE,
    );

    expect(lines(csv)[1]).toContain(',SALUD Y MÁS,11');
    expect(lines(csv)[2].endsWith('-59.9,,11')).toBe(true);
  });

  it('writes the month as an integer in the app zone', () => {
    // 2026-12-01T02:00Z is still Nov 30 in Lima.
    const csv = toBankCsv(
      [
        row({ transactionDate: new Date('2026-12-01T02:00:00Z') }),
        row({ transactionDate: new Date('2026-03-10T15:00:00Z') }),
      ],
      TIME_ZONE,
    );

    expect(lines(csv)[1].endsWith(',11')).toBe(true);
    expect(lines(csv)[2].endsWith(',3')).toBe(true);
  });

  it('quotes and defuses the category like any text cell', () => {
    const csv = toBankCsv([row({ category: { name: '=a,b' } })], TIME_ZONE);

    expect(lines(csv)[1]).toContain(`,"'=A,B",11`);
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
