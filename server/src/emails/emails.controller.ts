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
  keysetOrderBy,
  keysetWhere,
  monthRange,
  paginate,
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
    const keyset = keysetWhere('createdAt', { before, after });
    if (keyset) {
      where.OR = keyset;
    }

    // Fetch one extra row to know whether another page exists.
    const rows = await this.prisma.emailNotification.findMany({
      where,
      orderBy: keysetOrderBy('createdAt', { after }),
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
    const {
      rows: emails,
      olderCursor,
      newerCursor,
    } = paginate(rows, {
      before,
      after,
      pageSize: PAGE_SIZE,
      cursorOf: (row) => ({ date: row.createdAt, id: row.id }),
    });

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
      olderCursor,
      newerCursor,
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
