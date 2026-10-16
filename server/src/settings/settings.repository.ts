import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasWebhookToken(userId: string): Promise<boolean> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { webhookToken: true },
    });
    return account?.webhookToken != null;
  }

  // Returns false when the user already has a token (it is never overwritten).
  async setWebhookTokenIfUnset(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, webhookToken: null },
      data: { webhookToken: tokenHash },
    });
    return count > 0;
  }

  async findPasswordHash(userId: string): Promise<string | null> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return account?.passwordHash ?? null;
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
