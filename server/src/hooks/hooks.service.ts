import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { ParseError } from './parser/parser.interface.js';
import { ParserRegistry } from './parser/parser.registry.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class HooksService {
  private readonly logger = new Logger(HooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parserRegistry: ParserRegistry,
  ) {}

  async receiveEmail(userId: string, email: GmailWebhookDto): Promise<void> {
    const notification = await this.createNotification(userId, email);
    if (!notification) {
      // ponytail: same messageId re-delivered - already processed, no-op.
      return;
    }

    const parser = this.parserRegistry.find(email);
    if (!parser) {
      return;
    }

    try {
      const parsed = parser.parse(email);
      const transaction = await this.prisma.transaction.create({
        data: {
          userId,
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          operationDescription: parsed.operationDescription,
          operationType: parsed.operationType,
          operationNumber: parsed.operationNumber,
          cardLastFour: parsed.cardLastFour,
          transactionDate: parsed.transactionDate,
        },
      });
      await this.prisma.emailNotification.update({
        where: { id: notification.id },
        data: {
          parseStatus: 'PARSED',
          parserName: parser.name,
          transactionId: transaction.id,
        },
      });
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      this.logger.error({
        msg: 'Failed to parse bank email notification',
        parserName: parser.name,
        messageId: email.messageId,
        err: error,
      });
      await this.prisma.emailNotification.update({
        where: { id: notification.id },
        data: { parseStatus: 'FAILED', parserName: parser.name },
      });
    }
  }

  private async createNotification(userId: string, email: GmailWebhookDto) {
    try {
      return await this.prisma.emailNotification.create({
        data: {
          userId,
          messageId: email.messageId,
          fromAddress: email.from,
          subject: email.subject,
          body: email.body,
          bodyHtml: email.bodyHtml,
          receivedAt: email.receivedAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.warn({
          msg: 'Duplicate webhook delivery for an already-processed email',
          messageId: email.messageId,
          userId,
        });
        return null;
      }
      throw error;
    }
  }
}
