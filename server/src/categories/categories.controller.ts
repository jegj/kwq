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
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

const CURRENT_PATH = '/app/categories';

@Controller('app/categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('app-layout')
  async getCategories(@CurrentUser() user: AuthenticatedUser) {
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: user.id }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, icon: true, color: true, userId: true },
    });
    const categories = rows.map(({ userId, ...category }) => ({
      ...category,
      isOwnCategory: userId === user.id,
    }));
    return {
      title: 'Categories',
      page: './pages/categories',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      categories,
    };
  }

  @Post()
  @HttpCode(201)
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCategoryDto,
  ) {
    try {
      return await this.prisma.category.create({
        data: { ...body, userId: user.id },
        select: { id: true, name: true, icon: true, color: true },
      });
    } catch (error) {
      throw this.toConflictOrRethrow(error);
    }
  }

  @Patch(':id')
  @HttpCode(200)
  async updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCategoryDto,
  ) {
    try {
      const { count } = await this.prisma.category.updateMany({
        where: { id, userId: user.id },
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.category.deleteMany({
      where: { id, userId: user.id },
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
