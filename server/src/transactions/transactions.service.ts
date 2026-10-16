import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesRepository } from '../categories/categories.repository.js';
import {
  monthRange,
  paginate,
  parseCursor,
} from '../common/pagination.util.js';
import { APP_TIMEZONE, parseInputValue } from '../common/timezone.util.js';
import { ParserRegistry } from '../hooks/parser/parser.registry.js';
import type { TransactionDto } from './dto/transaction.dto.js';
import type { TransactionsQueryDto } from './dto/transactions-query.dto.js';
import {
  type TransactionRecord,
  TransactionsRepository,
} from './transactions.repository.js';

const PAGE_SIZE = 20;

// Sentinel filter values: no category / no source email.
const NONE = 'none';
const MANUAL = 'manual';

// Decimals are rendered as strings.
const toView = (row: TransactionRecord) => ({
  ...row,
  amount: String(row.amount),
});

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly parserRegistry: ParserRegistry,
  ) {}

  async list(userId: string, query: TransactionsQueryDto) {
    const month = monthRange(query.month);
    const after = parseCursor(query.after);
    // ponytail: ?after wins over ?before if both are sent.
    const before = after ? undefined : parseCursor(query.before);

    const categories = await this.categoriesRepository.findVisible(userId);
    const parsers = this.parserRegistry.names;
    const category =
      query.category === NONE
        ? NONE
        : categories.find((item) => item.id === query.category)?.id;
    const parser =
      query.parser === MANUAL
        ? MANUAL
        : parsers.find((name) => name === query.parser);

    // Fetch one extra row to know whether another page exists.
    const rows = await this.repository.findPage(
      userId,
      {
        month,
        categoryId:
          category === undefined
            ? undefined
            : category === NONE
              ? null
              : category,
        source:
          parser === undefined
            ? undefined
            : parser === MANUAL
              ? null
              : { parserName: parser },
      },
      { before, after },
      PAGE_SIZE + 1,
    );
    const page = paginate(rows, {
      before,
      after,
      pageSize: PAGE_SIZE,
      cursorOf: (row) => ({ date: row.transactionDate, id: row.id }),
    });

    return {
      transactions: page.rows.map(toView),
      categories,
      parsers,
      month: month ? query.month : null,
      category: category ?? null,
      parser: parser ?? null,
      olderCursor: page.olderCursor,
      newerCursor: page.newerCursor,
    };
  }

  async get(userId: string, id: string) {
    const row = await this.repository.findById(id, userId);
    if (!row) {
      throw new NotFoundException('Transaction not found.');
    }
    return {
      transaction: toView(row),
      categories: await this.categoriesRepository.findVisible(userId),
    };
  }

  async create(userId: string, body: TransactionDto) {
    const categoryId = body.categoryId ?? null;
    await this.assertCategoryAccessible(categoryId, userId);
    return this.repository.create({
      ...this.toData(body),
      userId,
      isManuallyCategorized: categoryId !== null,
    });
  }

  async update(userId: string, id: string, body: TransactionDto) {
    const existing = await this.repository.findCategoryId(id, userId);
    if (!existing) {
      throw new NotFoundException('Transaction not found.');
    }
    const categoryId = body.categoryId ?? null;
    const categoryChanged = categoryId !== existing.categoryId;
    if (categoryChanged) {
      await this.assertCategoryAccessible(categoryId, userId);
    }
    await this.repository.update(id, {
      ...this.toData(body),
      isManuallyCategorized: categoryChanged ? true : undefined,
    });
  }

  async remove(userId: string, id: string) {
    if (!(await this.repository.delete(id, userId))) {
      throw new NotFoundException('Transaction not found.');
    }
  }

  private toData(body: TransactionDto) {
    const transactionDate = parseInputValue(APP_TIMEZONE, body.transactionDate);
    if (!transactionDate) {
      throw new BadRequestException('Invalid transaction date.');
    }
    return {
      amount: body.amount,
      currency: body.currency,
      merchant: body.merchant,
      transactionDate,
      description: body.description ?? null,
      cardLastFour: body.cardLastFour ?? null,
      operationNumber: body.operationNumber ?? null,
      operationDescription: body.operationDescription ?? null,
      operationType: body.operationType ?? null,
      categoryId: body.categoryId ?? null,
    };
  }

  private async assertCategoryAccessible(
    categoryId: string | null,
    userId: string,
  ) {
    if (categoryId === null) {
      return;
    }
    if (!(await this.categoriesRepository.isAccessible(categoryId, userId))) {
      throw new BadRequestException('Unknown category.');
    }
  }
}
