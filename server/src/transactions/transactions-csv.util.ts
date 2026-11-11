import { toInputValue } from '../common/timezone.util.js';

export interface CsvTransaction {
  merchant: string;
  amount: string | number;
  currency: string;
  operationType: 'CREDIT' | 'DEBIT' | 'UNKNOWN' | null;
  transactionDate: Date;
}

const BOM = '﻿';
const HEADER = ['Fecha', 'Descripcion', 'Moneda', 'Monto'];
const CURRENCY_SYMBOLS: Record<string, string> = { PEN: 'S/', USD: '$' };
const FORMULA_START = /^[=+\-@]/;
const NEEDS_QUOTES = /[",\r\n]/;

// A cell starting with these runs as a formula when opened in a spreadsheet.
function defuseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function escapeField(text: string): string {
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Bank sheets carry debits as negatives; kwq stores a positive amount + type.
function signedAmount(row: CsvTransaction): string {
  const value = Number(row.amount);
  return String(row.operationType === 'CREDIT' ? value : -value);
}

// CSV in the BCP statement layout (Fecha, Descripcion, Moneda, Monto), so a
// month can be compared line by line with the bank's own file.
export function toBankCsv(rows: CsvTransaction[], timeZone: string): string {
  const body = rows.map((row) =>
    [
      toInputValue(timeZone, row.transactionDate).slice(0, 10),
      escapeField(defuseFormula(row.merchant)),
      CURRENCY_SYMBOLS[row.currency] ?? row.currency,
      signedAmount(row),
    ].join(','),
  );
  return `${BOM}${[HEADER.join(','), ...body].join('\r\n')}\r\n`;
}
