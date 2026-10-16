import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export class CategoryNameTakenError extends Error {}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Global (userId null) plus the user's own categories.
  findVisible(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, icon: true, color: true, userId: true },
    });
  }

  async create(userId: string, data: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { ...data, userId },
        select: { id: true, name: true, icon: true, color: true },
      });
    } catch (error) {
      throw this.toNameTaken(error);
    }
  }

  // Returns false when the category is global or belongs to someone else.
  async updateOwn(
    id: string,
    userId: string,
    data: CreateCategoryDto,
  ): Promise<boolean> {
    try {
      const { count } = await this.prisma.category.updateMany({
        where: { id, userId },
        data,
      });
      return count > 0;
    } catch (error) {
      throw this.toNameTaken(error);
    }
  }

  async deleteOwn(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.category.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }

  private toNameTaken(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
    ) {
      return new CategoryNameTakenError();
    }
    return error;
  }
}
