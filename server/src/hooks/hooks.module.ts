import { Module } from '@nestjs/common';
import { WebhookTokenGuard } from './guard/webhook-token.guard.js';
import { HooksController } from './hooks.controller.js';
import { HooksService } from './hooks.service.js';
import { ParserRegistry } from './parser/parser.registry.js';

@Module({
  controllers: [HooksController],
  providers: [WebhookTokenGuard, HooksService, ParserRegistry],
})
export class HooksModule {}
