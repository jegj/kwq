import type { GmailWebhookDto } from '../dto/email-webhook.dto.js';

export interface ParsedTransaction {
  amount: string;
  currency: string;
  merchant: string;
  operationType: string | null;
  operationNumber: string | null;
  cardLastFour: string | null;
  transactionDate: Date;
}

export interface BankParser {
  readonly name: string;
  canParse(email: GmailWebhookDto): boolean;
  parse(email: GmailWebhookDto): ParsedTransaction;
}

export class ParseError extends Error {}
