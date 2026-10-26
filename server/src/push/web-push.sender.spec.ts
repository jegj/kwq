import { beforeEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { WebPushSender } from './web-push.sender.js';

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

const subscription = {
  endpoint: 'https://push/1',
  p256dh: 'key',
  auth: 'auth',
};

function configWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

const vapid = {
  VAPID_PUBLIC_KEY: 'public',
  VAPID_PRIVATE_KEY: 'private',
  VAPID_SUBJECT: 'mailto:admin@kwq.local',
};

describe('WebPushSender', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signs with the VAPID keys and sends the payload in web-push shape', async () => {
    const sender = new WebPushSender(configWith(vapid) as any);

    await sender.send(subscription, '{"a":1}');

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:admin@kwq.local',
      'public',
      'private',
    );
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push/1', keys: { p256dh: 'key', auth: 'auth' } },
      '{"a":1}',
    );
  });

  it('sends nothing when VAPID keys are not configured', async () => {
    const sender = new WebPushSender(configWith({}) as any);

    await sender.send(subscription, '{}');

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('reports whether push is enabled', () => {
    expect(new WebPushSender(configWith(vapid) as any).enabled).toBe(true);
    expect(new WebPushSender(configWith({}) as any).enabled).toBe(false);
  });
});
