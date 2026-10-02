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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { AdminGuard } from '../auth/guard/admin.guard.js';
import { SessionGuard } from '../auth/guard/session.guard.js';
import { hashPassword } from '../auth/util/password.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Controller('app/admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getUsers(@Req() request: FastifyRequest) {
    const users = await this.prisma.user.findMany({
      where: { id: { not: request.user?.id } },
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

  @Post()
  @HttpCode(201)
  async createUser(@Body() body: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: body.email,
          role: body.role,
          passwordHash: hashPassword(body.password),
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
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
  ) {
    const { count } = await this.prisma.user.updateMany({
      where: { id, NOT: { id: request.user?.id } },
      data: { role: body.role },
    });
    if (count === 0) {
      throw new NotFoundException('User not found.');
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteUser(
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.user.deleteMany({
      where: { id, NOT: { id: request.user?.id } },
    });
    if (count === 0) {
      throw new NotFoundException('User not found.');
    }
  }
}
