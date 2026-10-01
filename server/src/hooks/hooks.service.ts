import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import {
  type ParsedTransaction,
  ParseError,
} from './parser/parser.interface.js';
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
    const parser = this.parserRegistry.find(email);

    let parsed: ParsedTransaction | null = null;
    if (parser) {
      try {
        parsed = parser.parse(email);
      } catch (error) {
        if (!(error instanceof ParseError)) throw error;
        this.logger.error({
          msg: 'Failed to parse bank email notification',
          parserName: parser.name,
          messageId: email.messageId,
          err: error,
        });
      }
    }

    // Everything below is one db transaction: notification creation
    // (with its duplicate-delivery check), the resulting Transaction row,
    // and the notification's final parseStatus all commit together, or
    // none of them do. That way a crash mid-way leaves nothing behind for
    // a retry to collide with (see createNotification's dup-check below).
    await this.prisma.$transaction(async (tx) => {
      let notification: { id: string } | null;
      try {
        notification = await tx.emailNotification.create({
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
          // ponytail: same messageId re-delivered - already processed, no-op.
          return;
        }
        throw error;
      }
      if (!parser) return;

      if (parsed) {
        const transaction = await tx.transaction.create({
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
        await tx.emailNotification.update({
          where: { id: notification.id },
          data: {
            parseStatus: 'PARSED',
            parserName: parser.name,
            transactionId: transaction.id,
          },
        });
      } else {
        await tx.emailNotification.update({
          where: { id: notification.id },
          data: { parseStatus: 'FAILED', parserName: parser.name },
        });
      }
    });
  }
}
