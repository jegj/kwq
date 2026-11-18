import { toInputValue } from '../common/timezone.util.js';

export interface CsvTransaction {
  merchant: string;
  amount: string | number;
  currency: string;
  operationType: 'CREDIT' | 'DEBIT' | 'UNKNOWN' | null;
  transactionDate: Date;
  description: string | null;
  category: { name: string } | null;
}

const BOM = '﻿';
const HEADER = ['Fecha', 'Descripcion', 'Moneda', 'Monto', 'Categoria', 'Mes'];
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

// Every amount is negative so the sheet can sum them as spending.
function negativeAmount(row: CsvTransaction): string {
  return String(-Math.abs(Number(row.amount)));
}

// CSV in the BCP statement layout (Fecha, Descripcion, Moneda, Monto) plus
// Categoria (uppercase) and Mes (1-12), so a month can be compared line by
// line with the bank's own file.
export function toBankCsv(rows: CsvTransaction[], timeZone: string): string {
  const body = rows.map((row) => {
    const localDate = toInputValue(timeZone, row.transactionDate).slice(0, 10);
    return [
      localDate,
      escapeField(
        defuseFormula(
          row.description
            ? `${row.merchant} - ${row.description}`
            : row.merchant,
        ),
      ),
      CURRENCY_SYMBOLS[row.currency] ?? row.currency,
      negativeAmount(row),
      escapeField(defuseFormula(row.category?.name.toUpperCase() ?? '')),
      Number(localDate.slice(5, 7)),
    ].join(',');
  });
  return `${BOM}${[HEADER.join(','), ...body].join('\r\n')}\r\n`;
}
