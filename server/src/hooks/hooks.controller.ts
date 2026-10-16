import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { SkipOriginCheck } from '../common/skip-origin-check.decorator.js';
import { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { WebhookTokenGuard } from './guard/webhook-token.guard.js';
import { HooksService } from './hooks.service.js';
import { HooksExceptionFilter } from './hooks-exception.filter.js';
import type { WebhookAuthenticatedUser } from './types/hooks.types.js';
import { WebhookUser } from './webhook-user.decorator.js';

// Called by the gscript with a token, not by a browser, so no Origin header.
@SkipOriginCheck()
@Controller('hooks')
@UseFilters(HooksExceptionFilter)
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Post('email')
  @HttpCode(200)
  @UseGuards(WebhookTokenGuard)
  async receiveGmail(
    @Body() payload: GmailWebhookDto,
    @WebhookUser() webhookUser: WebhookAuthenticatedUser,
  ) {
    await this.hooksService.receiveEmail(webhookUser.id, payload);
  }
}
