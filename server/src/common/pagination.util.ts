import { zonedToUtc } from './timezone.util.js';

export interface Cursor {
  date: Date;
  id: string;
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const CURSOR_PATTERN = /^(\d+)_([0-9a-f-]{36})$/i;

export function monthRange(
  timeZone: string,
  month: string | undefined,
): { gte: Date; lt: Date } | undefined {
  const match = month ? MONTH_PATTERN.exec(month) : null;
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    gte: zonedToUtc(timeZone, year, monthIndex, 1),
    lt: zonedToUtc(timeZone, year, monthIndex + 1, 1),
  };
}

export function formatCursor({ date, id }: Cursor): string {
  return `${date.getTime()}_${id}`;
}

export function parseCursor(value: string | undefined): Cursor | undefined {
  const match = value ? CURSOR_PATTERN.exec(value) : null;
  if (!match) {
    return undefined;
  }
  return { date: new Date(Number(match[1])), id: match[2] };
}

interface KeysetCursors {
  before?: Cursor;
  after?: Cursor;
}

type KeysetClause<Field extends string> = {
  [Key in Field]?: Date | { lt: Date } | { gt: Date };
} & { id?: { lt: string } | { gt: string } };

// ponytail: ?after wins over ?before if both are sent.
export function keysetWhere<Field extends string>(
  field: Field,
  { before, after }: KeysetCursors,
): KeysetClause<Field>[] | undefined {
  const [cursor, operator] = after
    ? [after, 'gt' as const]
    : [before, 'lt' as const];
  if (!cursor) {
    return undefined;
  }
  return [
    { [field]: { [operator]: cursor.date } },
    { [field]: cursor.date, id: { [operator]: cursor.id } },
  ] as KeysetClause<Field>[];
}

// Paging towards newer rows (`after`) reads oldest-first; `paginate` flips it back.
export function keysetOrderBy<Field extends string>(
  field: Field,
  { after }: Pick<KeysetCursors, 'after'>,
) {
  const direction = after ? 'asc' : 'desc';
  return [{ [field]: direction }, { id: direction }] as [
    Record<Field, 'asc' | 'desc'>,
    { id: 'asc' | 'desc' },
  ];
}

// `rows` were fetched with `take: pageSize + 1` and `keysetOrderBy`; the extra
// row only tells us whether another page exists in the direction of travel.
export function paginate<Row>(
  rows: Row[],
  options: KeysetCursors & {
    pageSize: number;
    cursorOf: (row: Row) => Cursor;
  },
): { rows: Row[]; olderCursor: string | null; newerCursor: string | null } {
  const { before, after, pageSize, cursorOf } = options;
  const hasMore = rows.length > pageSize;
  const trimmed = rows.slice(0, pageSize);
  const ordered = after ? trimmed.reverse() : trimmed;
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const hasOlder = after ? last !== undefined : hasMore;
  const hasNewer = after
    ? hasMore
    : before !== undefined && first !== undefined;

  return {
    rows: ordered,
    olderCursor: hasOlder ? formatCursor(cursorOf(last)) : null,
    newerCursor: hasNewer ? formatCursor(cursorOf(first)) : null,
  };
}
