import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParseStatus } from '@prisma/client';
import {
  monthRange,
  paginate,
  parseCursor,
} from '../common/pagination.util.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ParserRegistry } from '../hooks/parser/parser.registry.js';
import type { EmailsQueryDto } from './dto/emails-query.dto.js';
import { EmailsRepository } from './emails.repository.js';

const PAGE_SIZE = 20;

@Injectable()
export class EmailsService {
  constructor(
    private readonly repository: EmailsRepository,
    private readonly parserRegistry: ParserRegistry,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async list(userId: string, query: EmailsQueryDto) {
    const month = monthRange(this.config.get('APP_TIMEZONE'), query.month);
    const after = parseCursor(query.after);
    // ponytail: ?after wins over ?before if both are sent.
    const before = after ? undefined : parseCursor(query.before);

    const parsers = this.parserRegistry.names;
    const status = Object.values(ParseStatus).find(
      (value) => value === query.status,
    );
    const parser = parsers.find((name) => name === query.parser);

    // Fetch one extra row to know whether another page exists.
    const rows = await this.repository.findPage(
      userId,
      { month, status, parserName: parser },
      { before, after },
      PAGE_SIZE + 1,
    );
    const page = paginate(rows, {
      before,
      after,
      pageSize: PAGE_SIZE,
      cursorOf: (row) => ({ date: row.createdAt, id: row.id }),
    });

    return {
      emails: page.rows,
      month: month ? query.month : null,
      status: status ?? null,
      parser: parser ?? null,
      parsers,
      olderCursor: page.olderCursor,
      newerCursor: page.newerCursor,
    };
  }

  async get(userId: string, id: string) {
    const notification = await this.repository.findById(id, userId);
    if (!notification) {
      throw new NotFoundException('Email not found.');
    }
    return notification;
  }
}
