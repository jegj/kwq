import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { GmailWebhookDto } from '../dto/email-webhook.dto.js';
import { BcpParser } from './bcp/bcp.parser.js';
import { FalabellaParser } from './falabella/falabella.parser.js';
import { InterbankParser } from './interbank/interbank.parser.js';
import type { BankParser } from './parser.interface.js';

@Injectable()
export class ParserRegistry {
  private readonly parsers: BankParser[];

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const timeZone = config.get('APP_TIMEZONE');
    this.parsers = [
      new BcpParser(timeZone),
      new InterbankParser(timeZone),
      new FalabellaParser(timeZone),
    ];
  }

  get names(): string[] {
    return this.parsers.map((parser) => parser.name);
  }

  find(email: GmailWebhookDto): BankParser | null {
    return this.parsers.find((parser) => parser.canParse(email)) ?? null;
  }
}
