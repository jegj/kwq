import { Injectable } from '@nestjs/common';
import type { GmailWebhookDto } from '../dto/email-webhook.dto.js';
import { BcpParser } from './bcp/bcp.parser.js';
import type { BankParser } from './parser.interface.js';

@Injectable()
export class ParserRegistry {
  private readonly parsers: BankParser[] = [new BcpParser()];

  find(email: GmailWebhookDto): BankParser | null {
    return this.parsers.find((parser) => parser.canParse(email)) ?? null;
  }
}
