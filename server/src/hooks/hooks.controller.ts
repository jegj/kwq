import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { WebhookTokenGuard } from './guard/webhook-token.guard.js';
import { HooksService } from './hooks.service.js';
import { HooksExceptionFilter } from './hooks-exception.filter.js';

@Controller('hooks')
@UseFilters(HooksExceptionFilter)
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Post('email')
  @HttpCode(200)
  @UseGuards(WebhookTokenGuard)
  async receiveGmail(
    @Body() payload: GmailWebhookDto,
    @Req() request: FastifyRequest,
  ) {
    // biome-ignore lint/style/noNonNullAssertion: webhookUser is guaranteed to be set by the WebhookTokenGuard
    await this.hooksService.receiveEmail(request.webhookUser!.id, payload);
  }
}
