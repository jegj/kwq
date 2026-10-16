import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashPassword } from '../auth/util/password.util.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { EmailTakenError, UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  list(actingUserId: string) {
    return this.repository.findAllExcept(actingUserId);
  }

  async create(body: CreateUserDto) {
    try {
      return await this.repository.create({
        email: body.email,
        role: body.role,
        passwordHash: await hashPassword(body.password),
      });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        throw new ConflictException('A user with that email already exists.');
      }
      throw error;
    }
  }

  async updateRole(actingUserId: string, id: string, body: UpdateUserDto) {
    if (
      !(await this.repository.updateRoleExcept(id, actingUserId, body.role))
    ) {
      throw new NotFoundException('User not found.');
    }
  }

  async remove(actingUserId: string, id: string) {
    if (!(await this.repository.deleteExcept(id, actingUserId))) {
      throw new NotFoundException('User not found.');
    }
  }
}
