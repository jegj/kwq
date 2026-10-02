import { randomUUID } from 'node:crypto';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Render,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';
import { hashPassword, verifyPassword } from '../auth/util/password.util.js';
import { hashWebhookToken } from '../hooks/util/webhook-token.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

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

  @Patch('password')
  @HttpCode(200)
  async changePassword(
    @Req() request: FastifyRequest,
    @Body() body: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user?.id },
      select: { passwordHash: true },
    });
    if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    await this.prisma.user.update({
      where: { id: request.user?.id },
      data: { passwordHash: hashPassword(body.newPassword) },
    });
    return { success: true };
  }
}
