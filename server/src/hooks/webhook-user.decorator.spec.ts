import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { extractWebhookUser } from './webhook-user.decorator.js';

const contextWith = (request: object) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

describe('extractWebhookUser', () => {
  it('returns the user set by WebhookTokenGuard', () => {
    const webhookUser = { id: 'user-1', email: 'user@example.com' };

    expect(extractWebhookUser(undefined, contextWith({ webhookUser }))).toBe(
      webhookUser,
    );
  });

  it('throws Unauthorized when no guard set a user', () => {
    expect(() => extractWebhookUser(undefined, contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });
});
