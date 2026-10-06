import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, titleCase } from './format.util.js';

// Intl uses a non-breaking space between symbol and number.
const plain = (text: string) => text.replace(/ /g, ' ');

describe('formatMoney', () => {
  it('formats soles with the S/ symbol and two decimals', () => {
    expect(plain(formatMoney('24.9', 'PEN'))).toBe('S/ 24.90');
  });

  it('groups thousands', () => {
    expect(plain(formatMoney(1240.5, 'PEN'))).toBe('S/ 1,240.50');
  });

  it('falls back to amount + code for an unknown currency', () => {
    expect(formatMoney('10', 'ZZZZ')).toBe('10 ZZZZ');
  });
});

describe('formatDateTime', () => {
  it('renders Lima local time, 24h, without seconds', () => {
    expect(formatDateTime(new Date('2026-10-15T15:15:42Z'))).toBe(
      '15 Oct 2026, 10:15',
    );
  });
});

describe('titleCase', () => {
  it('title-cases all-uppercase bank text', () => {
    expect(titleCase('STARBUCKS MIRAFLORES')).toBe('Starbucks Miraflores');
  });

  it('leaves mixed-case text alone', () => {
    expect(titleCase('McDonald’s San Isidro')).toBe('McDonald’s San Isidro');
  });
});
