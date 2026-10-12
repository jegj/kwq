import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './types/auth.types.js';
import { verifyPassword } from './util/password.util.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn({ msg: 'Login failed: unknown email', email });
      return null;
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      this.logger.warn({ msg: 'Login failed: wrong password', email });
      await this.prisma.userActivity.create({
        data: { userId: user.id, action: 'LOGIN_FAILED' },
      });
      return null;
    }
    return { id: user.id, role: user.role, email: user.email };
  }

  async findSessionUser(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, role: user.role, email: user.email };
  }

  async recordLogin(userId: string): Promise<void> {
    await this.prisma.userActivity.create({
      data: { userId, action: 'LOGIN' },
    });
  }

  async recordLogout(userId: string): Promise<void> {
    await this.prisma.userActivity.create({
      data: { userId, action: 'LOGOUT' },
    });
  }
}
