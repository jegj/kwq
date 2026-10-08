import { Injectable } from '@nestjs/common';
import { monthRange } from '../common/pagination.util.js';
import {
  type CategoryTotal,
  type DailyTotalRow,
  DashboardRepository,
  type TransactionRow,
} from './dashboard.repository.js';

export interface MonthNav {
  month: string;
  label: string;
  prev: string;
  next: string | null;
}

export interface CategorySlice {
  name: string;
  color: string;
  amount: number;
}

export interface TransactionItem {
  id: string;
  merchant: string;
  categoryName: string | null;
  color: string;
  amount: number;
  date: string;
}

export interface MerchantTotal {
  merchant: string;
  amount: number;
  count: number;
}

export interface CurrencySummary {
  currency: string;
  total: number;
  count: number;
  average: number;
  delta: number | null;
  categories: CategorySlice[];
  topCategory: string | null;
  daily: number[];
  recent: TransactionItem[];
  biggest: TransactionItem[];
  topMerchants: MerchantTotal[];
  uncategorized: number;
}

const UNCATEGORIZED = 'Uncategorized';
const UNCATEGORIZED_COLOR = '#8b95a7';
const FALLBACK_COLORS = [
  '#e08a83',
  '#7aa2f7',
  '#e0af68',
  '#73daca',
  '#bb9af7',
  '#9ece6a',
];

const LIST_SIZE = 5;
const dateLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/Lima',
});

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
// Lima has no DST, so it is a fixed UTC-5.
const LIMA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

function formatMonth(year: number, monthIndex: number): string {
  // Date.UTC normalises overflow, so monthIndex -1 / 12 wrap the year.
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentMonth(now: Date): string {
  const lima = new Date(now.getTime() - LIMA_UTC_OFFSET_MS);
  return formatMonth(lima.getUTCFullYear(), lima.getUTCMonth());
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

// Spend per Lima day, `length` days long, zero where nothing was spent.
function dailyTotals(
  rows: DailyTotalRow[],
  currency: string,
  length: number,
): number[] {
  const perDay = new Array<number>(length).fill(0);
  for (const row of rows) {
    if (row.currency === currency) perDay[row.day - 1] = row.total;
  }
  return perDay;
}

function inCurrency<T extends { currency: string }>(
  rows: T[],
  currency: string,
): T[] {
  return rows.filter((row) => row.currency === currency);
}

function buildCategories(rows: CategoryTotal[]): CategorySlice[] {
  return [...rows]
    .sort((first, second) => second.total - first.total)
    .map((row, index) => ({
      name: row.name ?? UNCATEGORIZED,
      color: row.name
        ? (row.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length])
        : UNCATEGORIZED_COLOR,
      amount: row.total,
    }));
}

function toItem(
  row: TransactionRow,
  colorByName: Map<string, string>,
): TransactionItem {
  return {
    id: row.id,
    merchant: row.merchant,
    categoryName: row.categoryName,
    color:
      colorByName.get(row.categoryName ?? UNCATEGORIZED) ?? UNCATEGORIZED_COLOR,
    amount: row.amount,
    date: dateLabel.format(row.date),
  };
}

// Percent change vs the previous month, one decimal; null with no baseline.
function deltaPercent(total: number, previousTotal: number): number | null {
  if (previousTotal <= 0) return null;
  return Math.round(((total - previousTotal) / previousTotal) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  getMonthNav(requested: string | undefined, now = new Date()): MonthNav {
    const current = currentMonth(now);

    const match = requested ? MONTH_PATTERN.exec(requested) : null;
    // Same-length YYYY-MM strings compare chronologically.
    const month = match && requested! <= current ? requested! : current;

    const [year, monthNumber] = month.split('-').map(Number);
    const next = formatMonth(year, monthNumber);
    return {
      month,
      label: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(year, monthNumber - 1, 1))),
      prev: formatMonth(year, monthNumber - 2),
      next: month === current ? null : next,
    };
  }

  // `month` must already be validated by getMonthNav.
  async getSummaries(
    userId: string,
    month: string,
  ): Promise<CurrencySummary[]> {
    const [year, monthNumber] = month.split('-').map(Number);
    const range = monthRange(month)!;
    const previousRange = monthRange(formatMonth(year, monthNumber - 2))!;
    const [
      current,
      previous,
      categoryRows,
      recentRows,
      biggestRows,
      uncategorizedRows,
      merchantRows,
      dailyRows,
    ] = await Promise.all([
      this.repository.totalsByCurrency(userId, range),
      this.repository.totalsByCurrency(userId, previousRange),
      this.repository.totalsByCategory(userId, range),
      this.repository.recentTransactions(userId, range, LIST_SIZE),
      this.repository.biggestTransactions(userId, range, LIST_SIZE),
      this.repository.uncategorizedCounts(userId, range),
      this.repository.topMerchants(userId, range, LIST_SIZE),
      this.repository.dailyTotals(userId, range),
    ]);

    const previousTotals = new Map(
      previous.map((row) => [row.currency, row.total]),
    );
    const uncategorizedByCurrency = new Map(
      uncategorizedRows.map((row) => [row.currency, row.count]),
    );

    return current
      .map(({ currency, total, count }): CurrencySummary => {
        const categories = buildCategories(inCurrency(categoryRows, currency));
        const colorByName = new Map(
          categories.map((category) => [category.name, category.color]),
        );
        const item = (row: TransactionRow) => toItem(row, colorByName);
        return {
          currency,
          total,
          count,
          average: total / count,
          delta: deltaPercent(total, previousTotals.get(currency) ?? 0),
          categories,
          topCategory:
            categories.find((category) => category.name !== UNCATEGORIZED)
              ?.name ?? null,
          daily: dailyTotals(dailyRows, currency, daysInMonth(month)),
          recent: inCurrency(recentRows, currency).map(item),
          biggest: inCurrency(biggestRows, currency).map(item),
          topMerchants: inCurrency(merchantRows, currency).map(
            ({ merchant, amount, count }) => ({ merchant, amount, count }),
          ),
          uncategorized: uncategorizedByCurrency.get(currency) ?? 0,
        };
      })
      .sort((first, second) => second.count - first.count);
  }
}
