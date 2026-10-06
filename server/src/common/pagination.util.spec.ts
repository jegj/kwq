import { describe, expect, it } from 'vitest';
import {
  formatCursor,
  monthRange,
  parseCursor,
} from './pagination.util.js';

const ID = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b';

describe('monthRange', () => {
  it('returns Lima-local month boundaries expressed in UTC', () => {
    expect(monthRange('2026-09')).toEqual({
      gte: new Date('2026-09-01T05:00:00.000Z'),
      lt: new Date('2026-10-01T05:00:00.000Z'),
    });
  });

  it('rolls December over to January of the next year', () => {
    expect(monthRange('2026-12')?.lt).toEqual(
      new Date('2027-01-01T05:00:00.000Z'),
    );
  });

  it.each([undefined, '', '2026-13', '2026-9', 'nope'])(
    'ignores invalid value %j',
    (value) => {
      expect(monthRange(value)).toBeUndefined();
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
