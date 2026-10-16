import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hashPassword, verifyPassword } from '../auth/util/password.util.js';
import { hashWebhookToken } from '../hooks/util/webhook-token.util.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import { SettingsRepository } from './settings.repository.js';

@Injectable()
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  hasWebhookToken(userId: string): Promise<boolean> {
    return this.repository.hasWebhookToken(userId);
  }

  // Only the hash is stored; the plain token is returned once and not retrievable again.
  async generateWebhookToken(userId: string): Promise<{ token: string }> {
    const token = randomUUID();
    const stored = await this.repository.setWebhookTokenIfUnset(
      userId,
      hashWebhookToken(token),
    );
    if (!stored) {
      throw new ConflictException('A webhook token is already set.');
    }
    return { token };
  }

  async changePassword(userId: string, body: ChangePasswordDto): Promise<void> {
    const currentHash = await this.repository.findPasswordHash(userId);
    if (
      !currentHash ||
      !(await verifyPassword(body.currentPassword, currentHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    await this.repository.updatePasswordHash(
      userId,
      await hashPassword(body.newPassword),
    );
  }
}
