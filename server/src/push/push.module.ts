import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushController } from './push.controller.js';
import {
  PushSender,
  PushService,
  PushSubscriptionStore,
} from './push.service.js';
import { PushSubscriptionRepository } from './push-subscription.repository.js';
import { WebPushSender } from './web-push.sender.js';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [
    PushService,
    PushSubscriptionRepository,
    WebPushSender,
    { provide: PushSubscriptionStore, useExisting: PushSubscriptionRepository },
    { provide: PushSender, useExisting: WebPushSender },
  ],
  exports: [PushService],
})
export class PushModule {}
