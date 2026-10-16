import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Render,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

const CURRENT_PATH = '/app/categories';

@Controller('app/categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Render('app-layout')
  async getCategories(@CurrentUser() user: AuthenticatedUser) {
    return {
      title: 'Categories',
      page: './pages/categories',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      categories: await this.categoriesService.list(user.id),
    };
  }

  @Post()
  @HttpCode(201)
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCategoryDto,
  ) {
    return this.categoriesService.create(user.id, body);
  }

  @Patch(':id')
  @HttpCode(200)
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCategoryDto,
  ) {
    return this.categoriesService.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.remove(user.id, id);
  }
}
