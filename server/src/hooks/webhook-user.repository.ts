import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WebhookUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTokenHash(webhookToken: string) {
    return this.prisma.user.findUnique({ where: { webhookToken } });
  }
}
