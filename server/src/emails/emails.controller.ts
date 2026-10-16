import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import { ParseStatus, type Prisma } from '@prisma/client';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import {
  formatCursor,
  monthRange,
  parseCursor,
} from '../common/pagination.util.js';
import { ParserRegistry } from '../hooks/parser/parser.registry.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailsQueryDto } from './dto/emails-query.dto.js';

const PAGE_SIZE = 20;
const CURRENT_PATH = '/app/emails';

@Controller('app/emails')
@UseGuards(SessionGuard)
export class EmailsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parserRegistry: ParserRegistry,
  ) {}

  @Get()
  @Render('app-layout')
  async getEmails(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EmailsQueryDto,
  ) {
    const month = monthRange(query.month);
    const after = parseCursor(query.after);
    // ponytail: ?after wins over ?before if both are sent.
    const before = after ? undefined : parseCursor(query.before);

    const where: Prisma.EmailNotificationWhereInput = {
      userId: user.id,
    };
    if (month) {
      where.createdAt = month;
    }
    const parsers = this.parserRegistry.names;
    const status = Object.values(ParseStatus).find(
      (value) => value === query.status,
    );
    const parser = parsers.find((name) => name === query.parser);
    if (status) {
      where.parseStatus = status;
    }
    if (parser) {
      where.parserName = parser;
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
    const hasNewer = after
      ? hasMore
      : before !== undefined && first !== undefined;

    return {
      title: 'Email Notifications',
      page: './pages/emails',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      emails,
      month: month ? query.month : null,
      status: status ?? null,
      parser: parser ?? null,
      parsers,
      olderCursor: hasOlder
        ? formatCursor({ date: last.createdAt, id: last.id })
        : null,
      newerCursor: hasNewer
        ? formatCursor({ date: first.createdAt, id: first.id })
        : null,
    };
  }

  @Get(':id')
  @Render('app-layout')
  async getEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const notification = await this.prisma.emailNotification.findFirst({
      where: { id, userId: user.id },
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
      email: user.email,
      notification,
      role: user.role,
      currentPath: CURRENT_PATH,
    };
  }
}
