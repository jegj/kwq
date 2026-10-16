import { Injectable } from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export class EmailTakenError extends Error {}

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllExcept(userId: string) {
    return this.prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: { createdAt: 'asc' },
      select: publicUserSelect,
    });
  }

  async create(data: { email: string; role: Role; passwordHash: string }) {
    try {
      return await this.prisma.user.create({
        data,
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new EmailTakenError();
      }
      throw error;
    }
  }

  // The excluded user (the acting admin) can't be modified: false if no match.
  async updateRoleExcept(
    id: string,
    excludedUserId: string,
    role: Role,
  ): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id, NOT: { id: excludedUserId } },
      data: { role },
    });
    return count > 0;
  }

  async deleteExcept(id: string, excludedUserId: string): Promise<boolean> {
    const { count } = await this.prisma.user.deleteMany({
      where: { id, NOT: { id: excludedUserId } },
    });
    return count > 0;
  }
}
