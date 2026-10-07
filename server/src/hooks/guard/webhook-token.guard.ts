import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashWebhookToken } from '../util/webhook-token.util.js';

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.headers['x-kwq-token'];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { webhookToken: hashWebhookToken(token) },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    request.webhookUser = { id: user.id, email: user.email };
    return true;
  }
}
