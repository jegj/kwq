import { Injectable, Logger } from '@nestjs/common';

export type AlertEvent =
  | {
      type: 'transaction';
      id: string;
      merchant: string;
      amount: string;
      currency: string;
    }
  | { type: 'failed-email'; id: string };

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export abstract class PushSubscriptionStore {
  abstract save(
    userId: string,
    subscription: StoredSubscription,
  ): Promise<void>;
  abstract findByUserId(userId: string): Promise<StoredSubscription[]>;
  abstract deleteByEndpoint(endpoint: string): Promise<void>;
}

export abstract class PushSender {
  abstract send(
    subscription: StoredSubscription,
    payload: string,
  ): Promise<void>;
}

const GONE_STATUS_CODES = [404, 410];

function toPayload(event: AlertEvent): string {
  if (event.type === 'transaction') {
    return JSON.stringify({
      title: 'New transaction',
      body: `${event.merchant} · ${event.amount} ${event.currency}`,
      url: `/app/transactions/${event.id}`,
    });
  }
  return JSON.stringify({
    title: "Couldn't read a bank email",
    body: 'Tap to review and fix it',
    url: `/app/emails/${event.id}`,
  });
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly subscriptions: PushSubscriptionStore,
    private readonly sender: PushSender,
  ) {}

  // Best-effort: callers run this after the DB commit, so it never throws.
  async notify(userId: string, event: AlertEvent): Promise<void> {
    try {
      const payload = toPayload(event);
      const subscriptions = await this.subscriptions.findByUserId(userId);
      await Promise.all(
        subscriptions.map((subscription) =>
          this.sendOne(subscription, payload),
        ),
      );
    } catch (error) {
      this.logger.error({
        msg: 'Failed to send push alerts',
        userId,
        err: error,
      });
    }
  }

  private async sendOne(
    subscription: StoredSubscription,
    payload: string,
  ): Promise<void> {
    try {
      await this.sender.send(subscription, payload);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== undefined && GONE_STATUS_CODES.includes(statusCode)) {
        await this.subscriptions.deleteByEndpoint(subscription.endpoint);
        return;
      }
      this.logger.error({
        msg: 'Push send failed',
        endpoint: subscription.endpoint,
        err: error,
      });
    }
  }
}
