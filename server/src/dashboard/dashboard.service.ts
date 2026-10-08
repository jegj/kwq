import { Injectable } from "@nestjs/common";
import { monthRange } from "../common/pagination.util.js";
import {
  DashboardRepository,
  type TransactionRow,
} from "./dashboard.repository.js";

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

const UNCATEGORIZED = "Uncategorized";
const UNCATEGORIZED_COLOR = "#8b95a7";
const FALLBACK_COLORS = [
  "#e08a83",
  "#7aa2f7",
  "#e0af68",
  "#73daca",
  "#bb9af7",
  "#9ece6a",
];

const LIST_SIZE = 5;
const dateLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Lima",
});

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
// Lima has no DST, so it is a fixed UTC-5.
const LIMA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

function formatMonth(year: number, monthIndex: number): string {
  // Date.UTC normalises overflow, so monthIndex -1 / 12 wrap the year.
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(now: Date): string {
  const lima = new Date(now.getTime() - LIMA_UTC_OFFSET_MS);
  return formatMonth(lima.getUTCFullYear(), lima.getUTCMonth());
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

// Spend per Lima day, `length` days long.
function dailyTotals(
  rows: TransactionRow[],
  currency: string,
  length: number,
): number[] {
  const perDay = new Array<number>(length).fill(0);
  for (const row of rows) {
    if (row.currency !== currency) continue;
    const day = new Date(row.date.getTime() - LIMA_UTC_OFFSET_MS).getUTCDate();
    perDay[day - 1] += row.amount;
  }
  return perDay.map((value) => Math.round(value * 100) / 100);
}

function topMerchants(rows: TransactionRow[]): MerchantTotal[] {
  const totals = new Map<string, MerchantTotal>();
  for (const row of rows) {
    const entry = totals.get(row.merchant) ?? {
      merchant: row.merchant,
      amount: 0,
      count: 0,
    };
    entry.amount = Math.round((entry.amount + row.amount) * 100) / 100;
    entry.count += 1;
    totals.set(row.merchant, entry);
  }
  return [...totals.values()]
    .sort((first, second) => second.amount - first.amount)
    .slice(0, LIST_SIZE);
}

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  getMonthNav(requested: string | undefined, now = new Date()): MonthNav {
    const current = currentMonth(now);

    const match = requested ? MONTH_PATTERN.exec(requested) : null;
    // Same-length YYYY-MM strings compare chronologically.
    const month = match && requested! <= current ? requested! : current;

    const [year, monthNumber] = month.split("-").map(Number);
    const next = formatMonth(year, monthNumber);
    return {
      month,
      label: new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
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
    const [year, monthNumber] = month.split("-").map(Number);
    const previousMonth = formatMonth(year, monthNumber - 2);
    const [current, previous, categoryRows, currentAmounts, uncategorizedRows] =
      await Promise.all([
        this.repository.totalsByCurrency(userId, monthRange(month)!),
        this.repository.totalsByCurrency(userId, monthRange(previousMonth)!),
        this.repository.totalsByCategory(userId, monthRange(month)!),
        this.repository.transactionsInRange(userId, monthRange(month)!),
        this.repository.uncategorizedCounts(userId, monthRange(month)!),
      ]);

    const previousTotals = new Map(
      previous.map((row) => [row.currency, row.total]),
    );

    const uncategorizedByCurrency = new Map(
      uncategorizedRows.map((row) => [row.currency, row.count]),
    );

    return current
      .map(({ currency, total, count }) => {
        const previousTotal = previousTotals.get(currency) ?? 0;
        const categories = categoryRows
          .filter((row) => row.currency === currency)
          .sort((first, second) => second.total - first.total)
          .map((row, index) => ({
            name: row.name ?? UNCATEGORIZED,
            color: row.name
              ? (row.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length])
              : UNCATEGORIZED_COLOR,
            amount: row.total,
          }));
        const colorByName = new Map(
          categories.map((category) => [category.name, category.color]),
        );
        const rows = currentAmounts.filter((row) => row.currency === currency);
        const toItem = (row: TransactionRow): TransactionItem => ({
          id: row.id,
          merchant: row.merchant,
          categoryName: row.categoryName,
          color:
            colorByName.get(row.categoryName ?? UNCATEGORIZED) ??
            UNCATEGORIZED_COLOR,
          amount: row.amount,
          date: dateLabel.format(row.date),
        });
        return {
          currency,
          total,
          count,
          average: total / count,
          delta:
            previousTotal > 0
              ? Math.round(((total - previousTotal) / previousTotal) * 1000) /
                10
              : null,
          categories,
          topCategory:
            categories.find((category) => category.name !== UNCATEGORIZED)
              ?.name ?? null,
          daily: dailyTotals(currentAmounts, currency, daysInMonth(month)),
          recent: [...rows]
            .sort(
              (first, second) => second.date.getTime() - first.date.getTime(),
            )
            .slice(0, LIST_SIZE)
            .map(toItem),
          biggest: [...rows]
            .sort((first, second) => second.amount - first.amount)
            .slice(0, LIST_SIZE)
            .map(toItem),
          topMerchants: topMerchants(rows),
          uncategorized: uncategorizedByCurrency.get(currency) ?? 0,
        };
      })
      .sort((first, second) => second.count - first.count);
  }
}
