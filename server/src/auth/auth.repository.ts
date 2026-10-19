import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async recordActivity(
    userId: string,
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
  ): Promise<void> {
    await this.prisma.userActivity.create({ data: { userId, action } });
  }
}
