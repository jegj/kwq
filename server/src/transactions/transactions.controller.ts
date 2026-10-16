import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
import { APP_TIMEZONE, parseInputValue } from '../common/timezone.util.js';
import { ParserRegistry } from '../hooks/parser/parser.registry.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionDto } from './dto/transaction.dto.js';
import { TransactionsQueryDto } from './dto/transactions-query.dto.js';

const PAGE_SIZE = 20;
const CURRENT_PATH = '/app/transactions';

// Sentinel filter values: no category / no source email.
const NONE = 'none';
const MANUAL = 'manual';

const transactionSelect = {
  id: true,
  merchant: true,
  amount: true,
  currency: true,
  description: true,
  cardLastFour: true,
  operationNumber: true,
  operationDescription: true,
  operationType: true,
  transactionDate: true,
  categoryId: true,
  category: { select: { name: true, icon: true, color: true } },
  email: { select: { id: true, parserName: true } },
} satisfies Prisma.TransactionSelect;

@Controller('app/transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parserRegistry: ParserRegistry,
  ) {}

  @Get()
  @Render('app-layout')
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionsQueryDto,
  ) {
    const month = monthRange(query.month);
    const after = parseCursor(query.after);
    // ponytail: ?after wins over ?before if both are sent.
    const before = after ? undefined : parseCursor(query.before);

    const categories = await this.loadCategories(user.id);
    const parsers = this.parserRegistry.names;
    const category =
      query.category === NONE
        ? NONE
        : categories.find((item) => item.id === query.category)?.id;
    const parser =
      query.parser === MANUAL
        ? MANUAL
        : parsers.find((name) => name === query.parser);

    const where: Prisma.TransactionWhereInput = { userId: user.id };
    if (month) {
      where.transactionDate = month;
    }
    if (category) {
      where.categoryId = category === NONE ? null : category;
    }
    if (parser) {
      where.email = { is: parser === MANUAL ? null : { parserName: parser } };
    }
    const keyset = keysetWhere('transactionDate', { before, after });
    if (keyset) {
      where.OR = keyset;
    }

    // Fetch one extra row to know whether another page exists.
    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: keysetOrderBy('transactionDate', { after }),
      take: PAGE_SIZE + 1,
      select: transactionSelect,
    });
    const {
      rows: ordered,
      olderCursor,
      newerCursor,
    } = paginate(rows, {
      before,
      after,
      pageSize: PAGE_SIZE,
      cursorOf: (row) => ({ date: row.transactionDate, id: row.id }),
    });

    return {
      title: 'Transactions',
      page: './pages/transactions',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      transactions: ordered.map((row) => ({
        ...row,
        amount: String(row.amount),
      })),
      categories,
      parsers,
      month: month ? query.month : null,
      category: category ?? null,
      parser: parser ?? null,
      olderCursor,
      newerCursor,
    };
  }

  @Get(':id')
  @Render('app-layout')
  async getTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId: user.id },
      select: transactionSelect,
    });
    if (!row) {
      throw new NotFoundException('Transaction not found.');
    }
    return {
      title: row.merchant,
      page: './pages/transaction-detail',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      transaction: { ...row, amount: String(row.amount) },
      categories: await this.loadCategories(user.id),
    };
  }

  @Post()
  @HttpCode(201)
  async createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: TransactionDto,
  ) {
    const categoryId = body.categoryId ?? null;
    await this.assertCategoryAccessible(categoryId, user.id);
    return this.prisma.transaction.create({
      data: {
        ...this.toData(body),
        userId: user.id,
        isManuallyCategorized: categoryId !== null,
      },
      select: { id: true },
    });
  }

  @Patch(':id')
  @HttpCode(204)
  async updateTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransactionDto,
  ) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId: user.id },
      select: { categoryId: true },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found.');
    }
    const categoryId = body.categoryId ?? null;
    const categoryChanged = categoryId !== existing.categoryId;
    if (categoryChanged) {
      await this.assertCategoryAccessible(categoryId, user.id);
    }
    await this.prisma.transaction.update({
      where: { id },
      data: {
        ...this.toData(body),
        isManuallyCategorized: categoryChanged ? true : undefined,
      },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.transaction.deleteMany({
      where: { id, userId: user.id },
    });
    if (count === 0) {
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

  private loadCategories(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, icon: true },
    });
  }

  private async assertCategoryAccessible(
    categoryId: string | null,
    userId: string,
  ) {
    if (categoryId === null) {
      return;
    }
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('Unknown category.');
    }
  }
}
