import { Injectable } from '@nestjs/common';
import type { ParseStatus, Prisma } from '@prisma/client';
import {
  type Cursor,
  keysetOrderBy,
  keysetWhere,
} from '../common/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

const listSelect = {
  id: true,
  parserName: true,
  parseStatus: true,
  messageId: true,
  transactionId: true,
  createdAt: true,
} satisfies Prisma.EmailNotificationSelect;

const detailSelect = {
  id: true,
  messageId: true,
  fromAddress: true,
  subject: true,
  body: true,
  bodyHtml: true,
  receivedAt: true,
  parseStatus: true,
  parserName: true,
  transactionId: true,
  createdAt: true,
} satisfies Prisma.EmailNotificationSelect;

export type EmailListItem = Prisma.EmailNotificationGetPayload<{
  select: typeof listSelect;
}>;

export type EmailDetail = Prisma.EmailNotificationGetPayload<{
  select: typeof detailSelect;
}>;

// Omitted key = no filter on that field.
export interface EmailFilters {
  month?: { gte: Date; lt: Date };
  status?: ParseStatus;
  parserName?: string;
}

@Injectable()
export class EmailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPage(
    userId: string,
    filters: EmailFilters,
    cursors: { before?: Cursor; after?: Cursor },
    take: number,
  ): Promise<EmailListItem[]> {
    const where: Prisma.EmailNotificationWhereInput = { userId };
    if (filters.month) {
      where.createdAt = filters.month;
    }
    if (filters.status) {
      where.parseStatus = filters.status;
    }
    if (filters.parserName) {
      where.parserName = filters.parserName;
    }
    const keyset = keysetWhere('createdAt', cursors);
    if (keyset) {
      where.OR = keyset;
    }
    return this.prisma.emailNotification.findMany({
      where,
      orderBy: keysetOrderBy('createdAt', cursors),
      take,
      select: listSelect,
    });
  }

  findById(id: string, userId: string): Promise<EmailDetail | null> {
    return this.prisma.emailNotification.findFirst({
      where: { id, userId },
      select: detailSelect,
    });
  }
}
