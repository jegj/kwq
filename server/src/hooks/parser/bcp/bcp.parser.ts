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

// BCP sends other operations (transfers, service payments) from the same
// sender; only card consumptions are tracked.
const CONSUMPTION_SUBJECT =
  /Realizaste un consumo con tu Tarjeta de (Débito|Crédito) BCP/i;
const CONSUMPTION_BODY = /Consumo Tarjeta de (Débito|Crédito)/i;

function matchField(body: string, pattern: RegExp): string | null {
  return body.match(pattern)?.[1]?.trim() ?? null;
}

function stripTrailingPeriod(value: string): string {
  return value.replace(/\.$/, '');
}

function matchOperationType(body: string): OperationType {
  if (body.includes('Tarjeta de Crédito BCP')) return OperationType.CREDIT;
  if (body.includes('Tarjeta de Débito BCP')) return OperationType.DEBIT;
  return OperationType.UNKNOWN;
}

function parseAmount(body: string): { amount: string; currency: string } {
  const match = body.match(/Total del consumo \*(\$|S\/)\s*([\d,]+\.\d{2})\*/);
  if (!match) {
    throw new ParseError('Could not find amount/currency in email body');
  }
  const [, symbol, rawAmount] = match;
  const currency = CURRENCY_BY_SYMBOL[symbol];
  if (!currency) {
    throw new ParseError(`Unknown currency symbol: ${symbol}`);
  }
  return { amount: rawAmount.replace(/,/g, ''), currency };
}

function parseTransactionDate(body: string): Date {
  const raw = matchField(body, /Fecha y hora \*([^*]+)\*/);
  if (!raw) {
    throw new ParseError('Could not find transaction date in email body');
  }
  const match = raw.match(
    /(\d{1,2}) de (\w+) de (\d{4}) - (\d{1,2}):(\d{2}) (AM|PM)/i,
  );
  if (!match) {
    throw new ParseError(`Unrecognized date format: ${raw}`);
  }
  const [, day, monthName, year, hourStr, minute, meridiem] = match;
  const month = SPANISH_MONTHS[monthName.toLowerCase()];
  if (month === undefined) {
    throw new ParseError(`Unrecognized month name: ${monthName}`);
  }
  let hour = Number(hourStr) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;

  // The bank's "Fecha y hora" carries no zone: it is local to APP_TIMEZONE.
  return zonedToUtc(
    APP_TIMEZONE,
    Number(year),
    month,
    Number(day),
    hour,
    Number(minute),
  );
}

export class BcpParser implements BankParser {
  readonly name = 'bcp';

  canParse(email: GmailWebhookDto): boolean {
    // Keep in sync with BANKS.bcp.shouldTrack in kwq_watcher/banks.gs.
    return (
      CONSUMPTION_SUBJECT.test(email.subject) ||
      CONSUMPTION_BODY.test(email.body)
    );
  }

  parse(email: GmailWebhookDto): ParsedTransaction {
    const { body } = email;
    const { amount, currency } = parseAmount(body);

    const merchant = matchField(body, /Empresa \*([^*]+)\*/);
    if (!merchant) {
      throw new ParseError('Could not find merchant in email body');
    }

    const operationDescription = matchField(
      body,
      /Operaci[oó]n realizada \*([^*]+)\*/,
    );
    const operationNumber = matchField(
      body,
      /N[uú]mero de operaci[oó]n \*([^*]+)\*/,
    );
    const cardLastFour = matchField(
      body,
      /N[uú]mero de Tarjeta de Cr[eé]dito \*+(\d{4})\*/,
    );

    return {
      amount,
      currency,
      merchant: stripTrailingPeriod(merchant),
      operationDescription: operationDescription
        ? stripTrailingPeriod(operationDescription)
        : null,
      operationType: matchOperationType(body),
      operationNumber,
      cardLastFour,
      transactionDate: parseTransactionDate(body),
    };
  }
}
