import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { WebhookAuthenticatedUser } from './types/hooks.types.js';

// The user WebhookTokenGuard attached to the request.
export function extractWebhookUser(
  _data: unknown,
  context: ExecutionContext,
): WebhookAuthenticatedUser {
  const { webhookUser } = context.switchToHttp().getRequest<FastifyRequest>();
  if (!webhookUser) throw new UnauthorizedException();
  return webhookUser;
}

export const WebhookUser = createParamDecorator(extractWebhookUser);
