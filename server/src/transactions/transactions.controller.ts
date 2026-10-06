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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';
import {
  formatCursor,
  monthRange,
  parseCursor,
} from '../common/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionDto } from './dto/transaction.dto.js';

const PAGE_SIZE = 20;
const CURRENT_PATH = '/app/transactions';

interface TransactionsQuery {
  before?: string;
  after?: string;
  month?: string;
}

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
  email: { select: { id: true } },
} satisfies Prisma.TransactionSelect;

@Controller('app/transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getTransactions(
    @Req() request: FastifyRequest,
    @Query() query: TransactionsQuery,
  ) {
    const month = monthRange(query.month);
    const after = parseCursor(query.after);
    // ponytail: ?after wins over ?before if both are sent.
    const before = after ? undefined : parseCursor(query.before);

    const where: Prisma.TransactionWhereInput = { userId: request.user?.id };
    if (month) {
      where.transactionDate = month;
    }
    if (before) {
      where.OR = [
        { transactionDate: { lt: before.date } },
        { transactionDate: before.date, id: { lt: before.id } },
      ];
    }
    if (after) {
      where.OR = [
        { transactionDate: { gt: after.date } },
        { transactionDate: after.date, id: { gt: after.id } },
      ];
    }

    // ponytail: keyset logic duplicated from EmailsController; extract a shared
    // helper if a third paginated list shows up.
    // Fetch one extra row to know whether another page exists.
    const direction = after ? 'asc' : 'desc';
    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ transactionDate: direction }, { id: direction }],
      take: PAGE_SIZE + 1,
      select: transactionSelect,
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    const ordered = after ? page.reverse() : page;
    const first = ordered[0];
    const last = ordered[ordered.length - 1];

    const hasOlder = after ? last !== undefined : hasMore;
    const hasNewer = after
      ? hasMore
      : before !== undefined && first !== undefined;

    const cursorOf = (row: { transactionDate: Date; id: string }) =>
      formatCursor({ date: row.transactionDate, id: row.id });

    return {
      title: 'Transactions',
      page: './pages/transactions',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: CURRENT_PATH,
      transactions: ordered.map((row) => ({
        ...row,
        amount: String(row.amount),
      })),
      categories: await this.loadCategories(request.user?.id),
      month: month ? query.month : null,
      monthTotals: await this.loadMonthTotals(request.user?.id, month),
      olderCursor: hasOlder ? cursorOf(last) : null,
      newerCursor: hasNewer ? cursorOf(first) : null,
    };
  }

  @Get(':id')
  @Render('app-layout')
  async getTransaction(
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId: request.user?.id },
      select: transactionSelect,
    });
    if (!row) {
      throw new NotFoundException('Transaction not found.');
    }
    return {
      title: row.merchant,
      page: './pages/transaction-detail',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: CURRENT_PATH,
      transaction: { ...row, amount: String(row.amount) },
      categories: await this.loadCategories(request.user?.id),
    };
  }

  @Post()
  @HttpCode(201)
  async createTransaction(
    @Req() request: FastifyRequest,
    @Body() body: TransactionDto,
  ) {
    const categoryId = body.categoryId ?? null;
    await this.assertCategoryAccessible(categoryId, request.user?.id);
    return this.prisma.transaction.create({
      data: {
        ...this.toData(body),
        userId: request.user?.id as string,
        isManuallyCategorized: categoryId !== null,
      },
      select: { id: true },
    });
  }

  @Patch(':id')
  @HttpCode(204)
  async updateTransaction(
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransactionDto,
  ) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId: request.user?.id },
      select: { categoryId: true },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found.');
    }
    const categoryId = body.categoryId ?? null;
    const categoryChanged = categoryId !== existing.categoryId;
    if (categoryChanged) {
      await this.assertCategoryAccessible(categoryId, request.user?.id);
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
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.transaction.deleteMany({
      where: { id, userId: request.user?.id },
    });
    if (count === 0) {
      throw new NotFoundException('Transaction not found.');
    }
  }

  private toData(body: TransactionDto) {
    return {
      amount: body.amount,
      currency: body.currency,
      merchant: body.merchant,
      transactionDate: new Date(body.transactionDate),
      description: body.description ?? null,
      cardLastFour: body.cardLastFour ?? null,
      operationNumber: body.operationNumber ?? null,
      operationDescription: body.operationDescription ?? null,
      operationType: body.operationType ?? null,
      categoryId: body.categoryId ?? null,
    };
  }

  // Debits only: the total answers "how much did I spend this month".
  private async loadMonthTotals(
    userId: string | undefined,
    month: { gte: Date; lt: Date } | undefined,
  ) {
    if (!month) {
      return [];
    }
    const groups = await this.prisma.transaction.groupBy({
      by: ['currency'],
      where: { userId, operationType: 'DEBIT', transactionDate: month },
      _sum: { amount: true },
    });
    return groups.map((group) => ({
      currency: group.currency,
      total: String(group._sum.amount),
    }));
  }

  private loadCategories(userId: string | undefined) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  private async assertCategoryAccessible(
    categoryId: string | null,
    userId: string | undefined,
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
