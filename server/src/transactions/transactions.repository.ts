import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type Cursor,
  keysetOrderBy,
  keysetWhere,
} from '../common/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
  bankName: true,
  email: { select: { id: true } },
} satisfies Prisma.TransactionSelect;

export type TransactionRecord = Prisma.TransactionGetPayload<{
  select: typeof transactionSelect;
}>;

export type CsvRow = Prisma.TransactionGetPayload<{
  select: {
    merchant: true;
    amount: true;
    currency: true;
    operationType: true;
    transactionDate: true;
    category: { select: { name: true } };
  };
}>;

// Omitted key = no filter on that field.
export interface TransactionFilters {
  month?: { gte: Date; lt: Date };
  // null = uncategorized
  categoryId?: string | null;
  // null = no bank
  bankName?: string | null;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPage(
    userId: string,
    filters: TransactionFilters,
    cursors: { before?: Cursor; after?: Cursor },
    take: number,
  ): Promise<TransactionRecord[]> {
    const where: Prisma.TransactionWhereInput = { userId };
    if (filters.month) {
      where.transactionDate = filters.month;
    }
    if (filters.categoryId !== undefined) {
      where.categoryId = filters.categoryId;
    }
    if (filters.bankName !== undefined) {
      where.bankName = filters.bankName;
    }
    const keyset = keysetWhere('transactionDate', cursors);
    if (keyset) {
      where.OR = keyset;
    }
    return this.prisma.transaction.findMany({
      where,
      orderBy: keysetOrderBy('transactionDate', cursors),
      take,
      select: transactionSelect,
    });
  }

  // Whole month for the bank CSV. Bank-less rows (manual) ride along so a
  // fix you entered by hand still lines up with the bank's statement.
  findForExport(
    userId: string,
    month: { gte: Date; lt: Date },
    bankName: string,
  ): Promise<CsvRow[]> {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: month,
        OR: [{ bankName }, { bankName: null }],
      },
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
      select: {
        merchant: true,
        amount: true,
        currency: true,
        operationType: true,
        transactionDate: true,
        category: { select: { name: true } },
      },
    });
  }

  findById(id: string, userId: string): Promise<TransactionRecord | null> {
    return this.prisma.transaction.findFirst({
      where: { id, userId },
      select: transactionSelect,
    });
  }

  findForUpdate(
    id: string,
    userId: string,
  ): Promise<{
    categoryId: string | null;
    email: { id: string } | null;
  } | null> {
    return this.prisma.transaction.findFirst({
      where: { id, userId },
      select: { categoryId: true, email: { select: { id: true } } },
    });
  }

  create(
    data: Prisma.TransactionUncheckedCreateInput,
  ): Promise<{ id: string }> {
    return this.prisma.transaction.create({ data, select: { id: true } });
  }

  async update(
    id: string,
    userId: string,
    data: Prisma.TransactionUncheckedUpdateInput,
  ): Promise<void> {
    await this.prisma.transaction.update({ where: { id, userId }, data });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.transaction.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }
}
