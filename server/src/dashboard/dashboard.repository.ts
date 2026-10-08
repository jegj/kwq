import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { APP_TIMEZONE } from '../common/timezone.util.js';
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

export interface DailyTotalRow {
  currency: string;
  day: number;
  total: number;
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

  // transaction_date is timestamptz: AT TIME ZONE yields the local wall-clock day.
  dailyTotals(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<DailyTotalRow[]> {
    return this.prisma.$queryRaw<DailyTotalRow[]>`
      SELECT
        currency,
        extract(
          day FROM transaction_date AT TIME ZONE ${APP_TIMEZONE}::text
        )::int AS day,
        round(sum(amount), 2)::float8 AS total
      FROM transaction
      WHERE user_id = ${userId}::uuid
        AND transaction_date >= ${range.gte}
        AND transaction_date < ${range.lt}
      GROUP BY currency, day`;
  }

  recentTransactions(
    userId: string,
    range: { gte: Date; lt: Date },
    limit: number,
  ): Promise<TransactionRow[]> {
    return this.topTransactions(
      userId,
      range,
      limit,
      Prisma.sql`t.transaction_date DESC, t.id DESC`,
    );
  }

  biggestTransactions(
    userId: string,
    range: { gte: Date; lt: Date },
    limit: number,
  ): Promise<TransactionRow[]> {
    return this.topTransactions(
      userId,
      range,
      limit,
      Prisma.sql`t.amount DESC, t.id DESC`,
    );
  }

  // Top `limit` transactions per currency, in `orderBy` order.
  private topTransactions(
    userId: string,
    range: { gte: Date; lt: Date },
    limit: number,
    orderBy: Prisma.Sql,
  ): Promise<TransactionRow[]> {
    return this.prisma.$queryRaw<TransactionRow[]>`
      SELECT id, merchant, currency, amount, date, "categoryName"
      FROM (
        SELECT
          t.id,
          t.merchant,
          t.currency,
          t.amount::float8 AS amount,
          t.transaction_date AS date,
          c.name AS "categoryName",
          row_number() OVER (PARTITION BY t.currency ORDER BY ${orderBy}) AS rank
        FROM transaction t
        LEFT JOIN category c ON c.id = t.category_id
        WHERE t.user_id = ${userId}::uuid
          AND t.transaction_date >= ${range.gte}
          AND t.transaction_date < ${range.lt}
      ) ranked
      WHERE rank <= ${limit}
      ORDER BY currency, rank`;
  }
}
