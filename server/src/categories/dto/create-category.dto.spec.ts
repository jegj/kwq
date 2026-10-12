import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCategoryDto } from './create-category.dto.js';

async function invalidProperties(overrides: Record<string, unknown>) {
  const dto = plainToInstance(CreateCategoryDto, {
    name: 'Food',
    ...overrides,
  });
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('CreateCategoryDto icon', () => {
  it('accepts a multi-codepoint emoji', async () => {
    expect(await invalidProperties({ icon: '👨‍👩‍👧‍👦' })).toEqual([]);
  });

  it('rejects an oversized icon', async () => {
    expect(await invalidProperties({ icon: 'x'.repeat(17) })).toEqual(['icon']);
  });
});
