import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GmailWebhookDto } from './dto/email-webhook.dto.js';
import { WebhookTokenGuard } from './guard/webhook-token.guard.js';

@Controller('hooks')
export class HooksController {
  private readonly logger = new Logger(HooksController.name);

  @Post('email')
  @HttpCode(200)
  @UseGuards(WebhookTokenGuard)
  receiveGmail(@Body() payload: GmailWebhookDto) {
    this.logger.log(payload);
  }
}
