import { Module } from '@nestjs/common';
import { WebhookTokenGuard } from './guard/webhook-token.guard.js';
import { HooksController } from './hooks.controller.js';

@Module({
  controllers: [HooksController],
  providers: [WebhookTokenGuard],
})
export class HooksModule {}
