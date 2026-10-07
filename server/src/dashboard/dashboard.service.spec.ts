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

describe('DashboardService.getSummaries', () => {
  const userId = 'user-1';

  // Returns the stub rows keyed by the range's start month (UTC, Lima midnight is 05:00).
  function serviceWith(
    rowsByMonth: Record<string, any[]>,
    categoryRows: any[] = [],
  ) {
    const repository = {
      totalsByCategory: vi.fn(async () => categoryRows),
      transactionsInRange: vi.fn(async () => []),
      totalsByCurrency: vi.fn(
        async (_userId: string, range: { gte: Date }) =>
          rowsByMonth[range.gte.toISOString().slice(0, 7)] ?? [],
      ),
    } as unknown as DashboardRepository;
    return new DashboardService(repository);
  }

  it('returns an empty list for a month without transactions', async () => {
    expect(await serviceWith({}).getSummaries(userId, '2026-10')).toEqual([]);
  });

  it('computes total, count, average and delta against the previous month', async () => {
    const service = serviceWith({
      '2026-10': [{ currency: 'PEN', total: 300, count: 4 }],
      '2026-09': [{ currency: 'PEN', total: 400, count: 8 }],
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
      '2026-10': [{ currency: 'USD', total: 50, count: 1 }],
      '2026-09': [{ currency: 'PEN', total: 400, count: 8 }],
    });
    const [summary] = await service.getSummaries(userId, '2026-10');
    expect(summary.delta).toBeNull();
  });

  it('orders currencies by transaction count, busiest first', async () => {
    const service = serviceWith({
      '2026-10': [
        { currency: 'USD', total: 50, count: 1 },
        { currency: 'PEN', total: 300, count: 4 },
      ],
    });
    const summaries = await service.getSummaries(userId, '2026-10');
    expect(summaries.map((summary) => summary.currency)).toEqual([
      'PEN',
      'USD',
    ]);
  });
});

describe('DashboardService.getSummaries categories', () => {
  const userId = 'user-1';

  function serviceWith(categoryRows: any[]) {
    const repository = {
      totalsByCurrency: vi.fn(async (_userId: string, range: { gte: Date }) =>
        range.gte.toISOString().startsWith('2026-10')
          ? [
              { currency: 'PEN', total: 300, count: 4 },
              { currency: 'USD', total: 50, count: 1 },
            ]
          : [],
      ),
      totalsByCategory: vi.fn(async () => categoryRows),
      transactionsInRange: vi.fn(async () => []),
    } as unknown as DashboardRepository;
    return new DashboardService(repository);
  }

  it('groups categories per currency, biggest first', async () => {
    const summaries = await serviceWith([
      { currency: 'PEN', name: 'Transport', color: '#111111', total: 100 },
      { currency: 'PEN', name: 'Food', color: '#222222', total: 200 },
      { currency: 'USD', name: 'Shopping', color: '#333333', total: 50 },
    ]).getSummaries(userId, '2026-10');

    expect(summaries[0].categories).toEqual([
      { name: 'Food', color: '#222222', amount: 200 },
      { name: 'Transport', color: '#111111', amount: 100 },
    ]);
    expect(summaries[1].categories).toEqual([
      { name: 'Shopping', color: '#333333', amount: 50 },
    ]);
  });

  it('labels transactions without a category as Uncategorized', async () => {
    const [summary] = await serviceWith([
      { currency: 'PEN', name: null, color: null, total: 300 },
    ]).getSummaries(userId, '2026-10');

    expect(summary.categories).toEqual([
      { name: 'Uncategorized', color: '#8b95a7', amount: 300 },
    ]);
  });

  it('falls back to a palette color when a category has none', async () => {
    const [summary] = await serviceWith([
      { currency: 'PEN', name: 'Food', color: null, total: 300 },
    ]).getSummaries(userId, '2026-10');

    expect(summary.categories[0].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('picks the biggest real category as top, ignoring Uncategorized', async () => {
    const [summary] = await serviceWith([
      { currency: 'PEN', name: null, color: null, total: 250 },
      { currency: 'PEN', name: 'Food', color: '#222222', total: 50 },
    ]).getSummaries(userId, '2026-10');

    expect(summary.topCategory).toBe('Food');
  });

  it('has no top category when everything is uncategorized', async () => {
    const [summary] = await serviceWith([
      { currency: 'PEN', name: null, color: null, total: 300 },
    ]).getSummaries(userId, '2026-10');

    expect(summary.topCategory).toBeNull();
  });
});

describe('DashboardService.getSummaries pace', () => {
  const userId = 'user-1';

  function serviceWith(amountsByMonth: Record<string, any[]>) {
    const repository = {
      totalsByCurrency: vi.fn(async (_userId: string, range: { gte: Date }) => {
        const month = range.gte.toISOString().slice(0, 7);
        return month === '2026-10' || month === '2026-09'
          ? [{ currency: 'PEN', total: 150, count: 3 }]
          : [];
      }),
      totalsByCategory: vi.fn(async () => []),
      transactionsInRange: vi.fn(
        async (_userId: string, range: { gte: Date }) =>
          amountsByMonth[range.gte.toISOString().slice(0, 7)] ?? [],
      ),
    } as unknown as DashboardRepository;
    return new DashboardService(repository);
  }

  const amount = (iso: string, value: number, currency = 'PEN') => ({
    currency,
    amount: value,
    date: new Date(iso),
  });

  it('accumulates spend per Lima day and stops at today for the current month', async () => {
    const [summary] = await serviceWith({
      '2026-10': [
        // 03:00 UTC is still the previous day in Lima, so this lands on Oct 1
        amount('2026-10-02T03:00:00Z', 20),
        amount('2026-10-02T15:00:00Z', 100),
        amount('2026-10-05T15:00:00Z', 30),
        amount('2026-10-03T15:00:00Z', 999, 'USD'),
      ],
    }).getSummaries(userId, '2026-10', now);

    expect(summary.pace.current).toEqual([20, 120, 120, 120, 150, 150, 150]);
  });

  it('covers the whole month when it is a past one', async () => {
    const [summary] = await serviceWith({
      '2026-09': [amount('2026-09-03T15:00:00Z', 10)],
    }).getSummaries(userId, '2026-09', now);

    expect(summary.pace.current).toHaveLength(30);
    expect(summary.pace.current[29]).toBe(10);
  });

  it('adds the previous month cumulative series, trimmed to the shorter month', async () => {
    const [summary] = await serviceWith({
      '2026-10': [amount('2026-10-02T15:00:00Z', 20)],
      '2026-09': [amount('2026-09-03T15:00:00Z', 10)],
    }).getSummaries(userId, '2026-10', now);

    expect(summary.pace.previous).toHaveLength(30);
    expect(summary.pace.previous.slice(0, 4)).toEqual([0, 0, 10, 10]);
  });

  it('leaves the previous series empty when there was no spend', async () => {
    const [summary] = await serviceWith({
      '2026-10': [amount('2026-10-02T15:00:00Z', 20)],
    }).getSummaries(userId, '2026-10', now);

    expect(summary.pace.previous).toEqual([]);
  });
});

describe('DashboardService.getSummaries lists', () => {
  const userId = 'user-1';

  function serviceWith(rows: any[], categoryRows: any[] = []) {
    const repository = {
      totalsByCurrency: vi.fn(async (_userId: string, range: { gte: Date }) =>
        range.gte.toISOString().startsWith('2026-10')
          ? [
              { currency: 'PEN', total: 1, count: 1 },
              { currency: 'USD', total: 1, count: 1 },
            ]
          : [],
      ),
      totalsByCategory: vi.fn(async () => categoryRows),
      transactionsInRange: vi.fn(
        async (_userId: string, range: { gte: Date }) =>
          range.gte.toISOString().startsWith('2026-10') ? rows : [],
      ),
    } as unknown as DashboardRepository;
    return new DashboardService(repository);
  }

  const row = (id: number, overrides: Record<string, unknown> = {}) => ({
    id: `id-${id}`,
    merchant: `Shop ${id}`,
    currency: 'PEN',
    amount: 10,
    date: new Date(Date.UTC(2026, 9, id, 15)),
    categoryName: null,
    ...overrides,
  });

  it('lists the 5 most recent transactions of the currency, newest first', async () => {
    const rows = [1, 2, 3, 4, 5, 6].map((id) => row(id));
    const [pen] = await serviceWith([
      ...rows,
      row(7, { currency: 'USD' }),
    ]).getSummaries(userId, '2026-10', now);

    expect(pen.recent.map((item) => item.id)).toEqual([
      'id-6',
      'id-5',
      'id-4',
      'id-3',
      'id-2',
    ]);
  });

  it('lists the 5 biggest transactions, largest first', async () => {
    const rows = [5, 90, 20, 70, 10, 60, 30].map((amount, index) =>
      row(index + 1, { amount }),
    );
    const [pen] = await serviceWith(rows).getSummaries(userId, '2026-10', now);

    expect(pen.biggest.map((item) => item.amount)).toEqual([
      90, 70, 60, 30, 20,
    ]);
  });

  it('describes a list item with a Lima date label and its category color', async () => {
    const [pen] = await serviceWith(
      [row(3, { categoryName: 'Food', amount: 24.9 })],
      [{ currency: 'PEN', name: 'Food', color: '#222222', total: 24.9 }],
    ).getSummaries(userId, '2026-10', now);

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
    const [pen] = await serviceWith([row(3)]).getSummaries(
      userId,
      '2026-10',
      now,
    );

    expect(pen.recent[0].categoryName).toBeNull();
    expect(pen.recent[0].color).toBe('#8b95a7');
  });

  it('sums top merchants across their transactions, biggest first', async () => {
    const [pen] = await serviceWith([
      row(1, { merchant: 'Uber', amount: 10 }),
      row(2, { merchant: 'Wong', amount: 50 }),
      row(3, { merchant: 'Uber', amount: 15 }),
    ]).getSummaries(userId, '2026-10', now);

    expect(pen.topMerchants).toEqual([
      { merchant: 'Wong', amount: 50, count: 1 },
      { merchant: 'Uber', amount: 25, count: 2 },
    ]);
  });

  it('caps top merchants at 5', async () => {
    const rows = [1, 2, 3, 4, 5, 6].map((id) => row(id, { amount: id }));
    const [pen] = await serviceWith(rows).getSummaries(userId, '2026-10', now);

    expect(pen.topMerchants).toHaveLength(5);
  });

  it('counts the transactions without a category per currency', async () => {
    const [pen, usd] = await serviceWith([
      row(1),
      row(2, { categoryName: 'Food' }),
      row(3),
      row(4, { currency: 'USD', categoryName: 'Food' }),
    ]).getSummaries(userId, '2026-10', now);

    expect(pen.uncategorized).toBe(2);
    expect(usd.uncategorized).toBe(0);
  });
});
