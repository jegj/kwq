import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { hashWebhookToken } from '../util/webhook-token.util.js';

// Calls come from Google's shared IPs, so the per-IP default would lump every
// user together; key on the token instead (hashed, so raw tokens never sit in
// the throttler store). Missing token falls back to IP; WebhookTokenGuard
// rejects it right after anyway.
// ponytail: a flood of random invalid tokens gets a fresh bucket each and
// still hits the DB lookup; add a second IP-keyed throttler if that shows up.
@Injectable()
export class WebhookThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    request: Record<string, any>,
  ): Promise<string> {
    const token = request.headers?.['x-kwq-token'];
    return typeof token === 'string' && token.length > 0
      ? hashWebhookToken(token)
      : request.ip;
  }
}
