import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AlertEvent } from '../push/push.service.js';
import type { GmailWebhookDto } from './dto/email-webhook.dto.js';
import type { ParsedTransaction } from './parser/parser.interface.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

// What the matched parser produced; `parsed: null` means it threw a ParseError.
export interface ParseOutcome {
  parserName: string;
  parsed: ParsedTransaction | null;
}

// `event` is what the user should be alerted about, if anything.
export type StoreResult =
  | { status: 'duplicate' }
  | { status: 'created'; event: AlertEvent | null };

@Injectable()
export class EmailNotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // One db transaction: notification creation (with its duplicate-delivery
  // check), the resulting Transaction row, and the notification's final
  // parseStatus all commit together, or none of them do. That way a crash
  // mid-way leaves nothing behind for a retry to collide with.
  // `outcome` is null when no parser matched (notification stays UNPARSED).
  async store(
    userId: string,
    email: GmailWebhookDto,
    outcome: ParseOutcome | null,
  ): Promise<StoreResult> {
    return this.prisma.$transaction(async (tx) => {
      let notification: { id: string };
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
          select: { id: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
        ) {
          return { status: 'duplicate' };
        }
        throw error;
      }
      if (!outcome) return { status: 'created', event: null };

      const { parserName, parsed } = outcome;
      if (!parsed) {
        await tx.emailNotification.update({
          where: { id: notification.id },
          data: { parseStatus: 'FAILED', parserName },
          select: { id: true },
        });
        return {
          status: 'created',
          event: { type: 'failed-email', id: notification.id },
        };
      }

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
          parserName,
          transactionId: transaction.id,
        },
        select: { id: true },
      });
      return {
        status: 'created',
        event: {
          type: 'transaction',
          id: transaction.id,
          merchant: transaction.merchant,
          amount: transaction.amount.toString(),
          currency: transaction.currency,
        },
      };
    });
  }
}
