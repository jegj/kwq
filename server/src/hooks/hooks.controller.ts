import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, HttpCode, Logger, Post, Body } from '@nestjs/common';
import { GmailWebhookDto } from './dto/gmail-webhook.dto.js';

// ponytail: dumps every payload to disk for manual inspection while parsers
// don't exist yet; delete this once real parsing/storage lands.
const SAMPLES_DIR = join(import.meta.dirname, '../../tmp/webhook-samples');

@Controller('hooks')
export class HooksController {
  private readonly logger = new Logger(HooksController.name);

  @Post('email')
  @HttpCode(200)
  receiveGmail(@Body() payload: GmailWebhookDto) {
    this.logger.log(payload);

    mkdirSync(SAMPLES_DIR, { recursive: true });
    writeFileSync(
      join(SAMPLES_DIR, `${payload.messageId}.json`),
      JSON.stringify(payload, null, 2),
    );
  }
}
