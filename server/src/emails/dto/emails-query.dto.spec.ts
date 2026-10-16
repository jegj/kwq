import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { EmailsQueryDto } from './emails-query.dto.js';

async function invalidProperties(query: Record<string, unknown>) {
  const errors = await validate(plainToInstance(EmailsQueryDto, query));
  return errors.map((error) => error.property);
}

describe('EmailsQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await invalidProperties({})).toEqual([]);
  });

  it('accepts every supported filter', async () => {
    expect(
      await invalidProperties({
        before: '1_x',
        after: '1_x',
        month: '2026-09',
        status: 'FAILED',
        parser: 'bcp',
      }),
    ).toEqual([]);
  });

  it('rejects repeated params (arrays)', async () => {
    expect(await invalidProperties({ month: ['2026-09', '2026-10'] })).toEqual([
      'month',
    ]);
  });

  it('rejects oversized values', async () => {
    expect(await invalidProperties({ status: 'x'.repeat(65) })).toEqual([
      'status',
    ]);
  });
});
