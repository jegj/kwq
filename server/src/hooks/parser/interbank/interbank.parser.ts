import { OperationType } from '@prisma/client';
import { APP_TIMEZONE, zonedToUtc } from '../../../common/timezone.util.js';
import type { GmailWebhookDto } from '../../dto/email-webhook.dto.js';
import {
  type BankParser,
  type ParsedTransaction,
  ParseError,
} from '../parser.interface.js';

// Interbank sends many other emails from the same sender; only these are tracked.
// Keep in sync with BANKS.interbank.shouldTrack in kwq_watcher/banks.gs.
const CARD_SUBJECT =
  /se ha realizado un pago recurrente a tu Tarjeta|realizaste un consumo con tu Tarjeta/i;
const PLIN_SUBJECT = /Constancia de Pago Plin/i;

const SPANISH_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function matchField(body: string, label: string): string | null {
  return body.match(new RegExp(`^${label}: (.+)$`, 'm'))?.[1]?.trim() ?? null;
}

function requireField(body: string, label: string): string {
  const value = matchField(body, label);
  if (!value) throw new ParseError(`Could not find ${label} in email body`);
  return value;
}

// Plin constancia lays out "Label\n\nvalue" pairs instead of "Label: value".
function requirePlinField(body: string, label: string): string {
  const value = body.match(
    new RegExp(`^${label}\\s*\\n\\s*\\n(.+)$`, 'm'),
  )?.[1];
  if (!value?.trim()) {
    throw new ParseError(`Could not find ${label} in email body`);
  }
  return value.trim();
}

function parseAmount(rawValue: string): { amount: string; currency: string } {
  // "S/. 257.51" (recurring) and "S/ 48.00" both occur.
  const match = rawValue.match(/^(\$|S\/\.?)\s*([\d,]+\.\d{2})$/);
  if (!match) throw new ParseError('Unrecognized amount format');
  const [, symbol, rawAmount] = match;
  return {
    amount: rawAmount.replace(/,/g, ''),
    currency: symbol === '$' ? 'USD' : 'PEN',
  };
}

function toHour24(hourText: string, meridiem: string): number {
  const hour = Number(hourText) % 12;
  return meridiem.toUpperCase() === 'PM' ? hour + 12 : hour;
}

function parseCardDate(body: string): Date {
  const date = requireField(body, 'Fecha').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const time = requireField(body, 'Hora').match(/^(\d{1,2}):(\d{2}) (AM|PM)$/i);
  if (!date || !time) throw new ParseError('Unrecognized date/time format');
  const [, day, month, year] = date;
  const [, hour, minute, meridiem] = time;

  // Zone-less bank text: local to APP_TIMEZONE.
  return zonedToUtc(
    APP_TIMEZONE,
    Number(year),
    Number(month) - 1,
    Number(day),
    toHour24(hour, meridiem),
    Number(minute),
  );
}

// e.g. "29 Sep 2026 11:12 AM"
function parsePlinDate(body: string): Date {
  const match = requirePlinField(body, 'Fecha y hora').match(
    /^(\d{1,2}) (\p{L}{3}) (\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/iu,
  );
  const month = match ? SPANISH_MONTHS.indexOf(match[2].toLowerCase()) : -1;
  if (!match || month === -1)
    throw new ParseError('Unrecognized date/time format');
  const [, day, , year, hour, minute, meridiem] = match;

  return zonedToUtc(
    APP_TIMEZONE,
    Number(year),
    month,
    Number(day),
    toHour24(hour, meridiem),
    Number(minute),
  );
}

function parseCardEmail(body: string): ParsedTransaction {
  return {
    ...parseAmount(requireField(body, 'Monto')),
    merchant: requireField(body, 'Comercio'),
    operationDescription: null,
    operationType: OperationType.DEBIT,
    operationNumber: null,
    // Interbank masks all but the last 3 digits ("****215").
    cardLastFour: matchField(body, 'Tarjeta')?.match(/\*+(\d+)$/)?.[1] ?? null,
    transactionDate: parseCardDate(body),
  };
}

function parsePlinEmail(body: string): ParsedTransaction {
  return {
    ...parseAmount(requirePlinField(body, 'Monto y moneda')),
    merchant: requirePlinField(body, 'Destinatario'),
    operationDescription: `Plin a ${requirePlinField(body, 'Destino')}`,
    operationType: OperationType.DEBIT,
    operationNumber: requirePlinField(body, 'Código de operación'),
    // Paid from an account, not a card.
    cardLastFour: null,
    transactionDate: parsePlinDate(body),
  };
}

export class InterbankParser implements BankParser {
  readonly name = 'interbank';

  canParse(email: GmailWebhookDto): boolean {
    return CARD_SUBJECT.test(email.subject) || PLIN_SUBJECT.test(email.subject);
  }

  parse(email: GmailWebhookDto): ParsedTransaction {
    return PLIN_SUBJECT.test(email.subject)
      ? parsePlinEmail(email.body)
      : parseCardEmail(email.body);
  }
}
