import { describe, expect, it } from 'vitest';
import {
  currentMonthIn,
  parseInputValue,
  toInputValue,
  zonedToUtc,
} from './timezone.util.js';

describe('timezone util', () => {
  it('converts wall-clock time in the zone to UTC', () => {
    expect(zonedToUtc('America/Lima', 2026, 9, 7, 12, 0).toISOString()).toBe(
      '2026-10-07T17:00:00.000Z',
    );
  });

  it('honours DST for zones that have it', () => {
    expect(
      zonedToUtc('America/New_York', 2026, 0, 15, 12, 0).toISOString(),
    ).toBe('2026-01-15T17:00:00.000Z');
    expect(
      zonedToUtc('America/New_York', 2026, 6, 15, 12, 0).toISOString(),
    ).toBe('2026-07-15T16:00:00.000Z');
  });

  it('parses a datetime-local string in the zone', () => {
    expect(
      parseInputValue('America/Lima', '2026-10-07T12:00')?.toISOString(),
    ).toBe('2026-10-07T17:00:00.000Z');
  });

  it('returns undefined for a malformed datetime-local string', () => {
    expect(parseInputValue('America/Lima', 'nope')).toBeUndefined();
  });

  it('formats an instant as a datetime-local value in the zone', () => {
    expect(toInputValue('America/Lima', new Date('2026-11-01T02:00:00Z'))).toBe(
      '2026-10-31T21:00',
    );
  });

  it('returns the current YYYY-MM in the zone, not UTC', () => {
    expect(
      currentMonthIn('America/Lima', new Date('2026-11-01T02:00:00Z')),
    ).toBe('2026-10');
  });
});
