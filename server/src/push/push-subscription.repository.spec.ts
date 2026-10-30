import { describe, expect, it, vi } from 'vitest';
import { PushSubscriptionRepository } from './push-subscription.repository.js';

const subscription = {
  endpoint: 'https://push/1',
  p256dh: 'key',
  auth: 'auth',
};

function makeRepository() {
  const prisma = {
    pushSubscription: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([subscription]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, repository: new PushSubscriptionRepository(prisma as any) };
}

describe('PushSubscriptionRepository', () => {
  it('upserts per user and endpoint without touching other users’ rows', async () => {
    const { prisma, repository } = makeRepository();

    await repository.save('user-1', subscription);

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: {
        userId_endpoint: { userId: 'user-1', endpoint: 'https://push/1' },
      },
      create: { userId: 'user-1', ...subscription },
      update: { p256dh: 'key', auth: 'auth' },
      select: { id: true },
    });
  });

  it("lists only the user's subscriptions", async () => {
    const { prisma, repository } = makeRepository();

    const result = await repository.findByUserId('user-1');

    expect(result).toEqual([subscription]);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  });

  it('deletes by endpoint without failing when it is already gone', async () => {
    const { prisma, repository } = makeRepository();

    await repository.deleteByEndpoint('https://push/1');

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push/1' },
    });
  });
});
