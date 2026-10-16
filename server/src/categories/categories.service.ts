import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoriesRepository,
  CategoryNameTakenError,
} from './categories.repository.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  async list(userId: string) {
    const rows = await this.repository.findVisible(userId);
    return rows.map(({ userId: ownerId, ...category }) => ({
      ...category,
      isOwnCategory: ownerId === userId,
    }));
  }

  async create(userId: string, body: CreateCategoryDto) {
    try {
      return await this.repository.create(userId, body);
    } catch (error) {
      throw this.toConflictOrRethrow(error);
    }
  }

  async update(userId: string, id: string, body: CreateCategoryDto) {
    let updated: boolean;
    try {
      updated = await this.repository.updateOwn(id, userId, body);
    } catch (error) {
      throw this.toConflictOrRethrow(error);
    }
    if (!updated) {
      throw new NotFoundException('Category not found.');
    }
  }

  async remove(userId: string, id: string) {
    if (!(await this.repository.deleteOwn(id, userId))) {
      throw new NotFoundException('Category not found.');
    }
  }

  private toConflictOrRethrow(error: unknown): unknown {
    if (error instanceof CategoryNameTakenError) {
      return new ConflictException('A category with that name already exists.');
    }
    return error;
  }
}
