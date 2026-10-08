import { APP_TIMEZONE, zonedToUtc } from './timezone.util.js';

export interface Cursor {
  date: Date;
  id: string;
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const CURSOR_PATTERN = /^(\d+)_([0-9a-f-]{36})$/i;

export function monthRange(
  month: string | undefined,
): { gte: Date; lt: Date } | undefined {
  const match = month ? MONTH_PATTERN.exec(month) : null;
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    gte: zonedToUtc(APP_TIMEZONE, year, monthIndex, 1),
    lt: zonedToUtc(APP_TIMEZONE, year, monthIndex + 1, 1),
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
