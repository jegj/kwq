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
import { SessionGuard } from '../auth/guard/session.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Controller('app/categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getCategories(@Req() request: FastifyRequest) {
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: request.user?.id }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, icon: true, color: true, userId: true },
    });
    const categories = rows.map(({ userId, ...category }) => ({
      ...category,
      isOwnCategory: userId === request.user?.id,
    }));
    return {
      title: 'Categories',
      page: './pages/categories',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: request.url,
      categories,
    };
  }

  @Post()
  @HttpCode(201)
  async createCategory(
    @Req() request: FastifyRequest,
    @Body() body: CreateCategoryDto,
  ) {
    try {
      return await this.prisma.category.create({
        data: { ...body, userId: request.user?.id },
        select: { id: true, name: true, icon: true, color: true },
      });
    } catch (error) {
      throw this.toConflictOrRethrow(error);
    }
  }

  @Patch(':id')
  @HttpCode(200)
  async updateCategory(
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCategoryDto,
  ) {
    try {
      const { count } = await this.prisma.category.updateMany({
        where: { id, userId: request.user?.id },
        data: body,
      });
      if (count > 0) {
        return;
      }
    } catch (error) {
      throw this.toConflictOrRethrow(error);
    }
    throw new NotFoundException('Category not found.');
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteCategory(
    @Req() request: FastifyRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.category.deleteMany({
      where: { id, userId: request.user?.id },
    });
    if (count === 0) {
      throw new NotFoundException('Category not found.');
    }
  }

  private toConflictOrRethrow(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
    ) {
      return new ConflictException('A category with that name already exists.');
    }
    return error;
  }
}
