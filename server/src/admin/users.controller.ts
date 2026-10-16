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
import { AdminGuard } from '../auth/guard/admin.guard.js';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

const CURRENT_PATH = '/app/admin/users';

@Controller('app/admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Render('app-layout')
  async getUsers(@CurrentUser() user: AuthenticatedUser) {
    return {
      title: 'Users',
      page: './pages/admin-users',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      users: await this.usersService.list(user.id),
    };
  }

  @Post()
  @HttpCode(201)
  createUser(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  @HttpCode(200)
  updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.updateRole(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.remove(user.id, id);
  }
}
