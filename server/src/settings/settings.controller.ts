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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { hashPassword, verifyPassword } from '../auth/util/password.util.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { hashWebhookToken } from '../hooks/util/webhook-token.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

const CURRENT_PATH = '/app/settings';

@Controller('app/settings')
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { webhookToken: true },
    });
    return {
      title: 'Settings',
      page: './pages/settings',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      hasWebhookToken: account?.webhookToken != null,
    };
  }

  @Post('webhook-token')
  @HttpCode(200)
  async generateWebhookToken(@CurrentUser() user: AuthenticatedUser) {
    const token = randomUUID();
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, webhookToken: null },
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
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (
      !account ||
      !(await verifyPassword(body.currentPassword, account.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    return { success: true };
  }
}
