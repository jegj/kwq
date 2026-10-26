import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SubscribeDto } from './subscribe.dto.js';

async function invalidProperties(overrides: Record<string, unknown>) {
  const dto = plainToInstance(SubscribeDto, {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'key',
    auth: 'auth',
    ...overrides,
  });
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('SubscribeDto', () => {
  it('accepts a push service https endpoint with its keys', async () => {
    expect(await invalidProperties({})).toEqual([]);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'ftp://example.com/x',
    'not a url',
    '',
  ])('rejects the endpoint %j', async (endpoint) => {
    expect(await invalidProperties({ endpoint })).toEqual(['endpoint']);
  });

  it('rejects an endpoint without a tld (internal host)', async () => {
    expect(
      await invalidProperties({ endpoint: 'https://localhost/x' }),
    ).toEqual(['endpoint']);
  });

  it.each(['p256dh', 'auth'])('requires %s', async (field) => {
    expect(await invalidProperties({ [field]: '' })).toEqual([field]);
  });
});
