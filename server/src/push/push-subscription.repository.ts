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

  // Keyed by endpoint: the same browser logging in as another user moves the
  // subscription instead of duplicating it.
  async save(userId: string, subscription: StoredSubscription): Promise<void> {
    const { endpoint, p256dh, auth } = subscription;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth },
      update: { userId, p256dh, auth },
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
