import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SubscribeDto } from './subscribe.dto.js';

async function invalidProperties(endpoint: string) {
  const dto = plainToInstance(SubscribeDto, {
    endpoint,
    p256dh: 'key',
    auth: 'secret',
  });
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('SubscribeDto endpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('accepts the known push service %s', async (endpoint) => {
    expect(await invalidProperties(endpoint)).toEqual([]);
  });

  it.each([
    'https://127.0.0.1/x',
    'https://localhost/x',
    'https://169.254.169.254/latest/meta-data',
    'https://internal.local/x',
    'https://fcm.googleapis.com.evil.com/x',
    'https://fcm.googleapis.com@evil.com/x',
    'http://fcm.googleapis.com/x',
  ])('rejects %s', async (endpoint) => {
    expect(await invalidProperties(endpoint)).toEqual(['endpoint']);
  });
});
