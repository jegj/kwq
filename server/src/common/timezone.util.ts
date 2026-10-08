// The one place that knows which zone the bank emails and the users live in.
// Postgres stores plain instants (timestamptz); this zone only matters when
// reading zone-less text (emails, form inputs) or showing/bucketing by local time.
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Lima';

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function wallClock(timeZone: string, instant: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, Number(value)]),
  );
  return parts as Record<
    'year' | 'month' | 'day' | 'hour' | 'minute',
    number
  >;
}

function offsetMs(timeZone: string, instant: Date): number {
  const { year, month, day, hour, minute } = wallClock(timeZone, instant);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  return asUtc - Math.floor(instant.getTime() / 60000) * 60000;
}

// Wall-clock fields in `timeZone` -> the UTC instant they denote.
export function zonedToUtc(
  timeZone: string,
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, monthIndex, day, hour, minute);
  // Second pass settles the offset when the guess lands across a DST change.
  const first = naive - offsetMs(timeZone, new Date(naive));
  return new Date(naive - offsetMs(timeZone, new Date(first)));
}

// `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") read in `timeZone`.
export function parseInputValue(
  timeZone: string,
  value: string,
): Date | undefined {
  const match = INPUT_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  return zonedToUtc(timeZone, year, month - 1, day, hour, minute);
}

export function toInputValue(timeZone: string, instant: Date): string {
  const { year, month, day, hour, minute } = wallClock(timeZone, instant);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function currentMonthIn(timeZone: string, now: Date): string {
  return toInputValue(timeZone, now).slice(0, 7);
}
