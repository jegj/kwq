import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Render,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';
import { hashWebhookToken } from '../hooks/util/webhook-token.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('app/settings')
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getSettings(@Req() request: FastifyRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user?.id },
      select: { webhookToken: true },
    });
    return {
      title: 'Settings',
      page: './pages/settings',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: request.url,
      hasWebhookToken: user?.webhookToken != null,
    };
  }

  @Post('webhook-token')
  @HttpCode(200)
  async generateWebhookToken(@Req() request: FastifyRequest) {
    const token = randomUUID();
    const { count } = await this.prisma.user.updateMany({
      where: { id: request.user?.id, webhookToken: null },
      data: { webhookToken: hashWebhookToken(token) },
    });
    if (count === 0) {
      throw new ConflictException('A webhook token is already set.');
    }
    return { token };
  }
}
