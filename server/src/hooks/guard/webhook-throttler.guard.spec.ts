import { describe, expect, it } from 'vitest';
import { hashWebhookToken } from '../util/webhook-token.util.js';
import { WebhookThrottlerGuard } from './webhook-throttler.guard.js';

function trackerFor(request: Record<string, unknown>) {
  const guard = new WebhookThrottlerGuard({} as any, {} as any, {} as any);
  return (guard as any).getTracker(request) as Promise<string>;
}

describe('WebhookThrottlerGuard', () => {
  it('tracks by the hashed token, not the raw one', async () => {
    const tracker = await trackerFor({
      headers: { 'x-kwq-token': 'a-token' },
      ip: '1.2.3.4',
    });
    expect(tracker).toBe(hashWebhookToken('a-token'));
  });

  it('gives different tokens from the same IP separate buckets', async () => {
    const first = await trackerFor({
      headers: { 'x-kwq-token': 'token-a' },
      ip: '1.2.3.4',
    });
    const second = await trackerFor({
      headers: { 'x-kwq-token': 'token-b' },
      ip: '1.2.3.4',
    });
    expect(first).not.toBe(second);
  });

  it('falls back to the IP when the token header is missing', async () => {
    const tracker = await trackerFor({ headers: {}, ip: '1.2.3.4' });
    expect(tracker).toBe('1.2.3.4');
  });
});
