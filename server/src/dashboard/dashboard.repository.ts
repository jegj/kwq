import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface CategoryTotal {
  currency: string;
  name: string | null;
  color: string | null;
  total: number;
}

export interface UncategorizedCount {
  currency: string;
  count: number;
}

export interface MerchantTotalRow {
  currency: string;
  merchant: string;
  amount: number;
  count: number;
}

export interface TransactionRow {
  id: string;
  merchant: string;
  currency: string;
  amount: number;
  date: Date;
  categoryName: string | null;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async totalsByCurrency(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<CurrencyTotal[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['currency'],
      where: { userId, transactionDate: range },
      _sum: { amount: true },
      _count: true,
    });
    return groups.map((group) => ({
      currency: group.currency,
      total: Number(group._sum.amount ?? 0),
      count: group._count,
    }));
  }

  async totalsByCategory(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<CategoryTotal[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['currency', 'categoryId'],
      where: { userId, transactionDate: range },
      _sum: { amount: true },
    });
    const categoryIds = groups.flatMap((group) =>
      group.categoryId ? [group.categoryId] : [],
    );
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true },
    });
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );

    return groups.map((group) => {
      const category = group.categoryId
        ? categoriesById.get(group.categoryId)
        : undefined;
      return {
        currency: group.currency,
        name: category?.name ?? null,
        color: category?.color ?? null,
        total: Number(group._sum.amount ?? 0),
      };
    });
  }

  uncategorizedCounts(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<UncategorizedCount[]> {
    return this.prisma.$queryRaw<UncategorizedCount[]>`
      SELECT currency, count(*)::int AS count
      FROM transaction
      WHERE user_id = ${userId}::uuid
        AND transaction_date >= ${range.gte}
        AND transaction_date < ${range.lt}
        AND category_id IS NULL
      GROUP BY currency`;
  }

  topMerchants(
    userId: string,
    range: { gte: Date; lt: Date },
    limit: number,
  ): Promise<MerchantTotalRow[]> {
    return this.prisma.$queryRaw<MerchantTotalRow[]>`
      SELECT currency, merchant, amount, count
      FROM (
        SELECT
          currency,
          merchant,
          round(sum(amount), 2)::float8 AS amount,
          count(*)::int AS count,
          row_number() OVER (
            PARTITION BY currency
            ORDER BY sum(amount) DESC, merchant
          ) AS rank
        FROM transaction
        WHERE user_id = ${userId}::uuid
          AND transaction_date >= ${range.gte}
          AND transaction_date < ${range.lt}
        GROUP BY currency, merchant
      ) ranked
      WHERE rank <= ${limit}
      ORDER BY currency, rank`;
  }

  // ponytail: bucketed per Lima day and ranked in JS; move to SQL if a month ever holds thousands of rows
  async transactionsInRange(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<TransactionRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId, transactionDate: range },
      select: {
        id: true,
        merchant: true,
        currency: true,
        amount: true,
        transactionDate: true,
        category: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      merchant: row.merchant,
      currency: row.currency,
      amount: Number(row.amount),
      date: row.transactionDate,
      categoryName: row.category?.name ?? null,
    }));
  }
}
