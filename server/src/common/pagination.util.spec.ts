import { describe, expect, it } from 'vitest';
import {
  formatCursor,
  keysetOrderBy,
  keysetWhere,
  monthRange,
  paginate,
  parseCursor,
} from './pagination.util.js';

const ID = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b';

describe('monthRange', () => {
  it('returns Lima-local month boundaries expressed in UTC', () => {
    expect(monthRange('America/Lima', '2026-09')).toEqual({
      gte: new Date('2026-09-01T05:00:00.000Z'),
      lt: new Date('2026-10-01T05:00:00.000Z'),
    });
  });

  it('rolls December over to January of the next year', () => {
    expect(monthRange('America/Lima', '2026-12')?.lt).toEqual(
      new Date('2027-01-01T05:00:00.000Z'),
    );
  });

  it.each([undefined, '', '2026-13', '2026-9', 'nope'])(
    'ignores invalid value %j',
    (value) => {
      expect(monthRange('America/Lima', value)).toBeUndefined();
    },
  );
});

describe('cursor', () => {
  it('round-trips date and id', () => {
    const date = new Date('2026-09-29T12:23:35.123Z');
    expect(parseCursor(formatCursor({ date, id: ID }))).toEqual({
      date,
      id: ID,
    });
  });

  it.each([undefined, '', 'garbage', '123_not-a-uuid', `abc_${ID}`])(
    'returns undefined for invalid cursor %j',
    (value) => {
      expect(parseCursor(value)).toBeUndefined();
    },
  );
});

describe('keysetWhere', () => {
  const date = new Date('2026-09-29T12:00:00.000Z');

  it('returns nothing without a cursor', () => {
    expect(keysetWhere('createdAt', {})).toBeUndefined();
  });

  it('matches rows older than the before cursor', () => {
    expect(keysetWhere('createdAt', { before: { date, id: ID } })).toEqual([
      { createdAt: { lt: date } },
      { createdAt: date, id: { lt: ID } },
    ]);
  });

  it('matches rows newer than the after cursor', () => {
    expect(keysetWhere('createdAt', { after: { date, id: ID } })).toEqual([
      { createdAt: { gt: date } },
      { createdAt: date, id: { gt: ID } },
    ]);
  });

  it('lets after win when both cursors are sent', () => {
    const other = new Date('2026-01-01T00:00:00.000Z');
    expect(
      keysetWhere('createdAt', {
        before: { date: other, id: ID },
        after: { date, id: ID },
      }),
    ).toEqual(keysetWhere('createdAt', { after: { date, id: ID } }));
  });
});

describe('keysetOrderBy', () => {
  it('is newest first by default', () => {
    expect(keysetOrderBy('createdAt', {})).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('is oldest first when paging towards newer rows', () => {
    const cursor = { date: new Date(), id: ID };
    expect(keysetOrderBy('createdAt', { after: cursor })).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });
});

describe('paginate', () => {
  const rowAt = (n: number) => ({
    id: `0192a3b4-c5d6-7e8f-9a0b-${String(n).padStart(12, '0')}`,
    at: new Date(2026, 8, 30 - n),
  });
  // Rows as the DB returns them for a newest-first query: n=1 is newest.
  const newestFirst = (count: number) =>
    Array.from({ length: count }, (_, index) => rowAt(index + 1));
  const options = {
    pageSize: 2,
    cursorOf: (row: { id: string; at: Date }) => ({ date: row.at, id: row.id }),
  };
  const cursorOfRow = (row: { id: string; at: Date }) =>
    formatCursor({ date: row.at, id: row.id });

  it('first page: trims the extra row and offers only an older cursor', () => {
    const rows = newestFirst(3);

    const page = paginate(rows, options);

    expect(page.rows).toEqual(rows.slice(0, 2));
    expect(page.olderCursor).toBe(cursorOfRow(rows[1]));
    expect(page.newerCursor).toBeNull();
  });

  it('last page: no older cursor when nothing is left', () => {
    const page = paginate(newestFirst(2), options);

    expect(page.olderCursor).toBeNull();
  });

  it('before page: also offers a newer cursor', () => {
    const rows = newestFirst(2);

    const page = paginate(rows, {
      ...options,
      before: { date: new Date(), id: ID },
    });

    expect(page.newerCursor).toBe(cursorOfRow(rows[0]));
  });

  it('after page: reverses to newest first and always offers an older cursor', () => {
    // Fetched oldest-first, with one extra (newer) row.
    const fetched = [rowAt(3), rowAt(2), rowAt(1)];

    const page = paginate(fetched, {
      ...options,
      after: { date: new Date(), id: ID },
    });

    expect(page.rows).toEqual([rowAt(2), rowAt(3)]);
    expect(page.olderCursor).toBe(cursorOfRow(rowAt(3)));
    expect(page.newerCursor).toBe(cursorOfRow(rowAt(2)));
  });

  it('after page with no rows offers no cursors', () => {
    const page = paginate([], {
      ...options,
      after: { date: new Date(), id: ID },
    });

    expect(page).toEqual({ rows: [], olderCursor: null, newerCursor: null });
  });
});
