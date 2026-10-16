import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Render,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminGuard } from '../auth/guard/admin.guard.js';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { hashPassword } from '../auth/util/password.util.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

const CURRENT_PATH = '/app/admin/users';

@Controller('app/admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getUsers(@CurrentUser() user: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: { id: { not: user.id } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return {
      title: 'Users',
      page: './pages/admin-users',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      users,
    };
  }

  @Post()
  @HttpCode(201)
  async createUser(@Body() body: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: body.email,
          role: body.role,
          passwordHash: await hashPassword(body.password),
        },
        select: { id: true, email: true, role: true, createdAt: true },
      });
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('A user with that email already exists.');
      }
      throw error;
    }
  }

  @Patch(':id')
  @HttpCode(200)
  async updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
  ) {
    const { count } = await this.prisma.user.updateMany({
      where: { id, NOT: { id: user.id } },
      data: { role: body.role },
    });
    if (count === 0) {
      throw new NotFoundException('User not found.');
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.user.deleteMany({
      where: { id, NOT: { id: user.id } },
    });
    if (count === 0) {
      throw new NotFoundException('User not found.');
    }
  }
}
