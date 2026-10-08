import { describe, expect, it, vi } from 'vitest';
import type { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';

// 2026-10-07 12:00 in Lima
const now = new Date('2026-10-07T17:00:00Z');

describe('DashboardService.getMonthNav', () => {
  const service = new DashboardService({} as DashboardRepository);

  it('defaults to the current Lima month', () => {
    expect(service.getMonthNav(undefined, now).month).toBe('2026-10');
  });

  it('uses Lima time, not UTC, around month boundaries', () => {
    // 02:00 UTC on Nov 1st is still Oct 31st in Lima
    const lateOctober = new Date('2026-11-01T02:00:00Z');
    expect(service.getMonthNav(undefined, lateOctober).month).toBe('2026-10');
  });

  it('accepts a past month and links to its neighbours', () => {
    expect(service.getMonthNav('2026-03', now)).toEqual({
      month: '2026-03',
      label: 'March 2026',
      prev: '2026-02',
      next: '2026-04',
    });
  });

  it('wraps across year boundaries', () => {
    const january = service.getMonthNav('2026-01', now);
    expect(january.prev).toBe('2025-12');
    const december = service.getMonthNav('2025-12', now);
    expect(december.next).toBe('2026-01');
  });

  it('has no next link on the current month', () => {
    expect(service.getMonthNav('2026-10', now).next).toBeNull();
  });

  it('clamps a future month to the current one', () => {
    expect(service.getMonthNav('2027-02', now).month).toBe('2026-10');
  });

  it('falls back to the current month on a malformed value', () => {
    expect(service.getMonthNav('2026-13', now).month).toBe('2026-10');
    expect(service.getMonthNav('nope', now).month).toBe('2026-10');
  });
});

const userId = 'user-1';

interface Stubs {
  // Totals keyed by the range's start month (UTC, Lima midnight is 05:00).
  totalsByMonth?: Record<string, any[]>;
  categories?: any[];
  uncategorized?: any[];
  merchants?: any[];
  daily?: any[];
  recent?: any[];
  biggest?: any[];
}

const twoCurrencies = {
  '2026-10': [
    { currency: 'PEN', total: 300, count: 4 },
    { currency: 'USD', total: 50, count: 1 },
  ],
};

function serviceWith({
  totalsByMonth = twoCurrencies,
  categories = [],
  uncategorized = [],
  merchants = [],
  daily = [],
  recent = [],
  biggest = [],
}: Stubs = {}) {
  const repository = {
    totalsByCurrency: vi.fn(
      async (_userId: string, range: { gte: Date }) =>
        totalsByMonth[range.gte.toISOString().slice(0, 7)] ?? [],
    ),
    totalsByCategory: vi.fn(async () => categories),
    uncategorizedCounts: vi.fn(async () => uncategorized),
    topMerchants: vi.fn(async () => merchants),
    dailyTotals: vi.fn(async () => daily),
    recentTransactions: vi.fn(async () => recent),
    biggestTransactions: vi.fn(async () => biggest),
  } as unknown as DashboardRepository;
  return new DashboardService(repository);
}

describe('DashboardService.getSummaries', () => {
  it('returns an empty list for a month without transactions', async () => {
    const service = serviceWith({ totalsByMonth: {} });
    expect(await service.getSummaries(userId, '2026-10')).toEqual([]);
  });

  it('computes total, count, average and delta against the previous month', async () => {
    const service = serviceWith({
      totalsByMonth: {
        '2026-10': [{ currency: 'PEN', total: 300, count: 4 }],
        '2026-09': [{ currency: 'PEN', total: 400, count: 8 }],
      },
    });
    expect(await service.getSummaries(userId, '2026-10')).toMatchObject([
      {
        currency: 'PEN',
        total: 300,
        count: 4,
        average: 75,
        delta: -25,
        categories: [],
        topCategory: null,
      },
    ]);
  });

  it('hides the delta when the previous month has no spend in that currency', async () => {
    const service = serviceWith({
      totalsByMonth: {
        '2026-10': [{ currency: 'USD', total: 50, count: 1 }],
        '2026-09': [{ currency: 'PEN', total: 400, count: 8 }],
      },
    });
    const [summary] = await service.getSummaries(userId, '2026-10');
    expect(summary.delta).toBeNull();
  });

  it('orders currencies by transaction count, busiest first', async () => {
    const service = serviceWith({
      totalsByMonth: {
        '2026-10': [
          { currency: 'USD', total: 50, count: 1 },
          { currency: 'PEN', total: 300, count: 4 },
        ],
      },
    });
    const summaries = await service.getSummaries(userId, '2026-10');
    expect(summaries.map((summary) => summary.currency)).toEqual([
      'PEN',
      'USD',
    ]);
  });
});

describe('DashboardService.getSummaries categories', () => {
  it('groups categories per currency, biggest first', async () => {
    const summaries = await serviceWith({
      categories: [
        { currency: 'PEN', name: 'Transport', color: '#111111', total: 100 },
        { currency: 'PEN', name: 'Food', color: '#222222', total: 200 },
        { currency: 'USD', name: 'Shopping', color: '#333333', total: 50 },
      ],
    }).getSummaries(userId, '2026-10');

    expect(summaries[0].categories).toEqual([
      { name: 'Food', color: '#222222', amount: 200 },
      { name: 'Transport', color: '#111111', amount: 100 },
    ]);
    expect(summaries[1].categories).toEqual([
      { name: 'Shopping', color: '#333333', amount: 50 },
    ]);
  });

  it('labels transactions without a category as Uncategorized', async () => {
    const [summary] = await serviceWith({
      categories: [{ currency: 'PEN', name: null, color: null, total: 300 }],
    }).getSummaries(userId, '2026-10');

    expect(summary.categories).toEqual([
      { name: 'Uncategorized', color: '#8b95a7', amount: 300 },
    ]);
  });

  it('falls back to a palette color when a category has none', async () => {
    const [summary] = await serviceWith({
      categories: [{ currency: 'PEN', name: 'Food', color: null, total: 300 }],
    }).getSummaries(userId, '2026-10');

    expect(summary.categories[0].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('picks the biggest real category as top, ignoring Uncategorized', async () => {
    const [summary] = await serviceWith({
      categories: [
        { currency: 'PEN', name: null, color: null, total: 250 },
        { currency: 'PEN', name: 'Food', color: '#222222', total: 50 },
      ],
    }).getSummaries(userId, '2026-10');

    expect(summary.topCategory).toBe('Food');
  });

  it('has no top category when everything is uncategorized', async () => {
    const [summary] = await serviceWith({
      categories: [{ currency: 'PEN', name: null, color: null, total: 300 }],
    }).getSummaries(userId, '2026-10');

    expect(summary.topCategory).toBeNull();
  });
});

describe('DashboardService.getSummaries daily', () => {
  it('places spend on its day and zero-fills the rest of the month', async () => {
    const [summary] = await serviceWith({
      daily: [
        { currency: 'PEN', day: 1, total: 20 },
        { currency: 'PEN', day: 2, total: 100 },
        { currency: 'PEN', day: 5, total: 30 },
        { currency: 'USD', day: 3, total: 999 },
      ],
    }).getSummaries(userId, '2026-10');

    expect(summary.daily).toHaveLength(31);
    expect(summary.daily.slice(0, 6)).toEqual([20, 100, 0, 0, 30, 0]);
  });

  it('uses the real length of shorter months', async () => {
    const [summary] = await serviceWith({
      totalsByMonth: { '2026-09': [{ currency: 'PEN', total: 10, count: 1 }] },
      daily: [{ currency: 'PEN', day: 3, total: 10 }],
    }).getSummaries(userId, '2026-09');

    expect(summary.daily).toHaveLength(30);
    expect(summary.daily[2]).toBe(10);
  });
});

describe('DashboardService.getSummaries lists', () => {
  const row = (id: number, overrides: Record<string, unknown> = {}) => ({
    id: `id-${id}`,
    merchant: `Shop ${id}`,
    currency: 'PEN',
    amount: 10,
    date: new Date(Date.UTC(2026, 9, id, 15)),
    categoryName: null,
    ...overrides,
  });

  it('attaches the recent and biggest transactions of each currency, in order', async () => {
    const [pen, usd] = await serviceWith({
      recent: [row(3), row(2, { currency: 'USD' }), row(1)],
      biggest: [row(1), row(2, { currency: 'USD' }), row(3)],
    }).getSummaries(userId, '2026-10');

    expect(pen.recent.map((item) => item.id)).toEqual(['id-3', 'id-1']);
    expect(pen.biggest.map((item) => item.id)).toEqual(['id-1', 'id-3']);
    expect(usd.recent.map((item) => item.id)).toEqual(['id-2']);
    expect(usd.biggest.map((item) => item.id)).toEqual(['id-2']);
  });

  it('describes a list item with a Lima date label and its category color', async () => {
    const [pen] = await serviceWith({
      recent: [row(3, { categoryName: 'Food', amount: 24.9 })],
      categories: [
        { currency: 'PEN', name: 'Food', color: '#222222', total: 24.9 },
      ],
    }).getSummaries(userId, '2026-10');

    expect(pen.recent[0]).toEqual({
      id: 'id-3',
      merchant: 'Shop 3',
      categoryName: 'Food',
      color: '#222222',
      amount: 24.9,
      date: 'Oct 3',
    });
  });

  it('shows Uncategorized in muted gray for a transaction without category', async () => {
    const [pen] = await serviceWith({ recent: [row(3)] }).getSummaries(
      userId,
      '2026-10',
    );

    expect(pen.recent[0].categoryName).toBeNull();
    expect(pen.recent[0].color).toBe('#8b95a7');
  });

  it('attaches the top merchants of each currency', async () => {
    const [pen, usd] = await serviceWith({
      merchants: [
        { currency: 'PEN', merchant: 'Wong', amount: 50, count: 1 },
        { currency: 'USD', merchant: 'Uber', amount: 25, count: 2 },
      ],
    }).getSummaries(userId, '2026-10');

    expect(pen.topMerchants).toEqual([
      { merchant: 'Wong', amount: 50, count: 1 },
    ]);
    expect(usd.topMerchants).toEqual([
      { merchant: 'Uber', amount: 25, count: 2 },
    ]);
  });

  it('counts the transactions without a category per currency', async () => {
    const [pen, usd] = await serviceWith({
      uncategorized: [{ currency: 'PEN', count: 2 }],
    }).getSummaries(userId, '2026-10');

    expect(pen.uncategorized).toBe(2);
    expect(usd.uncategorized).toBe(0);
  });
});
