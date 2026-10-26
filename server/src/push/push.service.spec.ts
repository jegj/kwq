import { describe, expect, it, vi } from 'vitest';
import { type AlertEvent, PushService } from './push.service.js';

const subscription = {
  endpoint: 'https://push/1',
  p256dh: 'key',
  auth: 'auth',
};

const transactionEvent: AlertEvent = {
  type: 'transaction',
  id: 'txn-1',
  merchant: 'Wong',
  amount: '10.00',
  currency: 'PEN',
};

const failedEmailEvent: AlertEvent = { type: 'failed-email', id: 'email-1' };

function makeService(
  subscriptions = [subscription],
  send: (...args: unknown[]) => Promise<void> = async () => undefined,
) {
  const repository = {
    findByUserId: vi.fn().mockResolvedValue(subscriptions),
    deleteByEndpoint: vi.fn().mockResolvedValue(undefined),
  };
  const sender = { send: vi.fn(send) };
  const service = new PushService(repository as any, sender as any);
  return { service, repository, sender };
}

function sentPayload(sender: { send: ReturnType<typeof vi.fn> }) {
  return JSON.parse(sender.send.mock.calls[0][1]);
}

describe('PushService', () => {
  it('links a transaction alert to the transaction page', async () => {
    const { service, sender } = makeService();

    await service.notify('user-1', transactionEvent);

    expect(sender.send).toHaveBeenCalledWith(subscription, expect.any(String));
    const payload = sentPayload(sender);
    expect(payload.url).toBe('/app/transactions/txn-1');
    expect(payload.body).toContain('Wong');
  });

  it('links a failed email alert to the email page', async () => {
    const { service, sender } = makeService();

    await service.notify('user-1', failedEmailEvent);

    const payload = sentPayload(sender);
    expect(payload.url).toBe('/app/emails/email-1');
    expect(payload.title).toBe("Couldn't read a bank email");
    expect(payload.body).toBe('Tap to review and fix it');
  });

  it('sends to every subscription of the user', async () => {
    const other = { ...subscription, endpoint: 'https://push/2' };
    const { service, sender, repository } = makeService([subscription, other]);

    await service.notify('user-1', transactionEvent);

    expect(repository.findByUserId).toHaveBeenCalledWith('user-1');
    expect(sender.send).toHaveBeenCalledTimes(2);
  });

  it.each([404, 410])(
    'prunes a subscription that answers %i',
    async (statusCode) => {
      const { service, repository } = makeService([subscription], async () => {
        throw Object.assign(new Error('gone'), { statusCode });
      });

      await service.notify('user-1', transactionEvent);

      expect(repository.deleteByEndpoint).toHaveBeenCalledWith(
        subscription.endpoint,
      );
    },
  );

  it('keeps the subscription and never throws on other send errors', async () => {
    const { service, repository } = makeService([subscription], async () => {
      throw Object.assign(new Error('server error'), { statusCode: 500 });
    });

    await expect(
      service.notify('user-1', transactionEvent),
    ).resolves.toBeUndefined();
    expect(repository.deleteByEndpoint).not.toHaveBeenCalled();
  });

  it('keeps sending to the rest when one subscription fails', async () => {
    const other = { ...subscription, endpoint: 'https://push/2' };
    const { service, sender } = makeService(
      [subscription, other],
      vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(undefined),
    );

    await service.notify('user-1', transactionEvent);

    expect(sender.send).toHaveBeenCalledTimes(2);
  });

  it('never throws when loading subscriptions fails', async () => {
    const { service, repository } = makeService();
    repository.findByUserId.mockRejectedValue(new Error('db down'));

    await expect(
      service.notify('user-1', transactionEvent),
    ).resolves.toBeUndefined();
  });
});
