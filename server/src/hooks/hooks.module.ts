import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { EmailNotificationRepository } from './email-notification.repository.js';
import { WebhookTokenGuard } from './guard/webhook-token.guard.js';
import { HooksController } from './hooks.controller.js';
import { HooksService } from './hooks.service.js';
import { ParserRegistry } from './parser/parser.registry.js';
import { WebhookUserRepository } from './webhook-user.repository.js';

@Module({
  imports: [PushModule],
  controllers: [HooksController],
  providers: [
    WebhookTokenGuard,
    HooksService,
    EmailNotificationRepository,
    ParserRegistry,
    WebhookUserRepository,
  ],
  exports: [ParserRegistry],
})
export class HooksModule {}
