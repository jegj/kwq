import { Controller, Get, Render, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AdminGuard } from '../auth/guard/admin.guard.js';
import { SessionGuard } from '../auth/guard/session.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('app/admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getUsers(@Req() request: FastifyRequest) {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return {
      title: 'Users',
      page: './pages/admin-users',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: request.url,
      users,
    };
  }
}
