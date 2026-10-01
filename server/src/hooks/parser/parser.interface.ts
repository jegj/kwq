import type { OperationType } from '@prisma/client';
import type { GmailWebhookDto } from '../dto/email-webhook.dto.js';

export interface ParsedTransaction {
  amount: string;
  currency: string;
  merchant: string;
  operationDescription: string | null;
  operationType: OperationType;
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
