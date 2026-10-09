import { OperationType } from '@prisma/client';
import { APP_TIMEZONE, zonedToUtc } from '../../../common/timezone.util.js';
import type { GmailWebhookDto } from '../../dto/email-webhook.dto.js';
import {
  type BankParser,
  type ParsedTransaction,
  ParseError,
} from '../parser.interface.js';

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  $: 'USD',
  'S/': 'PEN',
};

function matchField(body: string, label: string): string | null {
  return body.match(new RegExp(`^${label}: (.+)$`, 'm'))?.[1]?.trim() ?? null;
}

function requireField(body: string, label: string): string {
  const value = matchField(body, label);
  if (!value) throw new ParseError(`Could not find ${label} in email body`);
  return value;
}

function parseAmount(body: string): { amount: string; currency: string } {
  const match = requireField(body, 'Monto').match(
    /^(\$|S\/)\s*([\d,]+\.\d{2})$/,
  );
  if (!match) throw new ParseError('Unrecognized amount format');
  const [, symbol, rawAmount] = match;
  return {
    amount: rawAmount.replace(/,/g, ''),
    currency: CURRENCY_BY_SYMBOL[symbol],
  };
}

function parseTransactionDate(body: string): Date {
  const date = requireField(body, 'Fecha').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const time = requireField(body, 'Hora').match(/^(\d{1,2}):(\d{2}) (AM|PM)$/i);
  if (!date || !time) throw new ParseError('Unrecognized date/time format');
  const [, day, month, year] = date;
  const [, hourStr, minute, meridiem] = time;
  let hour = Number(hourStr) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;

  // Zone-less bank text: local to APP_TIMEZONE.
  return zonedToUtc(
    APP_TIMEZONE,
    Number(year),
    Number(month) - 1,
    Number(day),
    hour,
    Number(minute),
  );
}

export class InterbankParser implements BankParser {
  readonly name = 'interbank';

  canParse(email: GmailWebhookDto): boolean {
    return email.from.toLowerCase().includes('interbank');
  }

  parse(email: GmailWebhookDto): ParsedTransaction {
    const { body } = email;
    const { amount, currency } = parseAmount(body);

    return {
      amount,
      currency,
      merchant: requireField(body, 'Comercio'),
      operationDescription: null,
      // ponytail: email doesn't say credit vs debit, add a check if Interbank ever does
      operationType: OperationType.UNKNOWN,
      operationNumber: null,
      // Interbank masks all but the last 3 digits ("****215").
      cardLastFour:
        matchField(body, 'Tarjeta')?.match(/\*+(\d+)$/)?.[1] ?? null,
      transactionDate: parseTransactionDate(body),
    };
  }
}
