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
  US$: 'USD',
  'S/': 'PEN',
};

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  setiembre: 8,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
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
    /^(US\$|\$|S\/)\s*([\d,]+\.\d{2})$/,
  );
  if (!match) throw new ParseError('Unrecognized amount format');
  const [, symbol, rawAmount] = match;
  return {
    amount: rawAmount.replace(/,/g, ''),
    currency: CURRENCY_BY_SYMBOL[symbol],
  };
}

function parseTransactionDate(body: string): Date {
  const date = requireField(body, 'Fecha').match(/^(\d{1,2})-(\w+)-(\d{4})$/);
  const time = requireField(body, 'Hora').match(/^(\d{1,2}):(\d{2})$/);
  if (!date || !time) throw new ParseError('Unrecognized date/time format');
  const [, day, monthName, year] = date;
  const month = SPANISH_MONTHS[monthName.toLowerCase()];
  if (month === undefined) {
    throw new ParseError(`Unrecognized month name: ${monthName}`);
  }

  // Zone-less bank text (24h): local to APP_TIMEZONE.
  return zonedToUtc(
    APP_TIMEZONE,
    Number(year),
    month,
    Number(day),
    Number(time[1]),
    Number(time[2]),
  );
}

export class FalabellaParser implements BankParser {
  readonly name = 'falabella';

  canParse(email: GmailWebhookDto): boolean {
    return email.from.toLowerCase().includes('bancofalabella');
  }

  parse(email: GmailWebhookDto): ParsedTransaction {
    const { body } = email;
    const { amount, currency } = parseAmount(body);

    return {
      amount,
      currency,
      merchant: requireField(body, 'Comercio'),
      operationDescription: null,
      // ponytail: only CMR (credit) emails seen so far
      operationType: OperationType.CREDIT,
      operationNumber: matchField(body, 'Número de operación'),
      cardLastFour:
        matchField(body, 'Tarjeta')?.match(/\*+(\d{4})$/)?.[1] ?? null,
      transactionDate: parseTransactionDate(body),
    };
  }
}
