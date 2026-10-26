import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PushSender, type StoredSubscription } from './push.service.js';

@Injectable()
export class WebPushSender extends PushSender {
  readonly enabled: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    const publicKey = config.get('VAPID_PUBLIC_KEY');
    const privateKey = config.get('VAPID_PRIVATE_KEY');
    const subject = config.get('VAPID_SUBJECT');
    this.enabled = Boolean(publicKey && privateKey && subject);
    if (this.enabled) webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async send(
    { endpoint, p256dh, auth }: StoredSubscription,
    payload: string,
  ): Promise<void> {
    if (!this.enabled) return;
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      payload,
    );
  }
}
