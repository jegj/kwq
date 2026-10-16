import { Injectable, Logger } from '@nestjs/common';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { EmailNotificationRepository } from './email-notification.repository.js';
import {
  type BankParser,
  type ParsedTransaction,
  ParseError,
} from './parser/parser.interface.js';
import { ParserRegistry } from './parser/parser.registry.js';

@Injectable()
export class HooksService {
  private readonly logger = new Logger(HooksService.name);

  constructor(
    private readonly notifications: EmailNotificationRepository,
    private readonly parserRegistry: ParserRegistry,
  ) {}

  async receiveEmail(userId: string, email: GmailWebhookDto): Promise<void> {
    const parser = this.parserRegistry.find(email);

    if (!parser) {
      this.logger.warn({
        msg: 'No parser matched the email, storing it as UNPARSED',
        messageId: email.messageId,
        from: email.from,
        subject: email.subject,
      });
    }

    const outcome = parser
      ? { parserName: parser.name, parsed: this.parse(parser, email) }
      : null;
    const result = await this.notifications.store(userId, email, outcome);

    if (result === 'duplicate') {
      // Same messageId re-delivered: already processed, no-op.
      this.logger.warn({
        msg: 'Duplicate webhook delivery for an already-processed email',
        messageId: email.messageId,
        userId,
      });
    }
  }

  private parse(
    parser: BankParser,
    email: GmailWebhookDto,
  ): ParsedTransaction | null {
    try {
      return parser.parse(email);
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      this.logger.error({
        msg: 'Failed to parse bank email notification',
        parserName: parser.name,
        messageId: email.messageId,
        err: error,
      });
      return null;
    }
  }
}
