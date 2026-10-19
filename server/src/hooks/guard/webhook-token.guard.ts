import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { hashWebhookToken } from '../util/webhook-token.util.js';
import { WebhookUserRepository } from '../webhook-user.repository.js';

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(private readonly webhookUsers: WebhookUserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.headers['x-kwq-token'];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }

    const user = await this.webhookUsers.findByTokenHash(
      hashWebhookToken(token),
    );
    if (!user) {
      throw new UnauthorizedException();
    }

    request.webhookUser = { id: user.id, email: user.email };
    return true;
  }
}
