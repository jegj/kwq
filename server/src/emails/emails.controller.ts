import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Render,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  formatCursor,
  monthRange,
  parseCursor,
} from '../common/pagination.util.js';

const PAGE_SIZE = 20;
const CURRENT_PATH = '/app/emails';

interface EmailsQuery {
  before?: string;
  after?: string;
  month?: string;
}

@Controller('app/emails')
@UseGuards(SessionGuard)
export class EmailsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getEmails(@Req() request: FastifyRequest, @Query() query: EmailsQuery) {
    const month = monthRange(query.month);
    const after = parseCursor(query.after);
    // ponytail: ?after wins over ?before if both are sent.
    const before = after ? undefined : parseCursor(query.before);

    const where: Prisma.EmailNotificationWhereInput = {
      userId: request.user?.id,
    };
    if (month) {
      where.createdAt = month;
    }
    if (before) {
      where.OR = [
        { createdAt: { lt: before.date } },
        { createdAt: before.date, id: { lt: before.id } },
      ];
    }
    if (after) {
      where.OR = [
        { createdAt: { gt: after.date } },
        { createdAt: after.date, id: { gt: after.id } },
      ];
    }

    // Fetch one extra row to know whether another page exists.
    const direction = after ? 'asc' : 'desc';
    const rows = await this.prisma.emailNotification.findMany({
      where,
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        parserName: true,
        parseStatus: true,
        messageId: true,
        transactionId: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    const emails = after ? page.reverse() : page;
    const first = emails[0];
    const last = emails[emails.length - 1];

    const hasOlder = after ? last !== undefined : hasMore;
    const hasNewer = after ? hasMore : before !== undefined && first !== undefined;

    return {
      title: 'Email Notifications',
      page: './pages/emails',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: CURRENT_PATH,
      emails,
      month: month ? query.month : null,
      olderCursor: hasOlder ? formatCursor({ date: last.createdAt, id: last.id }) : null,
      newerCursor: hasNewer ? formatCursor({ date: first.createdAt, id: first.id }) : null,
    };
  }

  @Get(':id')
  @Render('app-layout')
  async getEmail(
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const notification = await this.prisma.emailNotification.findFirst({
      where: { id, userId: request.user?.id },
      select: {
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
      },
    });
    if (!notification) {
      throw new NotFoundException('Email not found.');
    }
    return {
      title: notification.subject,
      page: './pages/email-detail',
      email: request.user?.email,
      notification,
      role: request.user?.role,
      currentPath: CURRENT_PATH,
    };
  }
}
