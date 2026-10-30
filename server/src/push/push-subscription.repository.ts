import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PushSubscriptionStore,
  type StoredSubscription,
} from './push.service.js';

@Injectable()
export class PushSubscriptionRepository extends PushSubscriptionStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Keyed per user: another user can't take over (or break) a subscription by
  // sending its endpoint. One browser used by two accounts gets both users' alerts.
  async save(userId: string, subscription: StoredSubscription): Promise<void> {
    const { endpoint, p256dh, auth } = subscription;
    await this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      create: { userId, endpoint, p256dh, auth },
      update: { p256dh, auth },
      select: { id: true },
    });
  }

  findByUserId(userId: string): Promise<StoredSubscription[]> {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
