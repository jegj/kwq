import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { EmailsQueryDto } from './dto/emails-query.dto.js';
import { EmailsService } from './emails.service.js';

const CURRENT_PATH = '/app/emails';

@Controller('app/emails')
@UseGuards(SessionGuard)
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get()
  @Render('app-layout')
  async getEmails(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EmailsQueryDto,
  ) {
    return {
      title: 'Email Notifications',
      page: './pages/emails',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      ...(await this.emailsService.list(user.id, query)),
    };
  }

  @Get(':id')
  @Render('app-layout')
  async getEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const notification = await this.emailsService.get(user.id, id);
    return {
      title: notification.subject,
      page: './pages/email-detail',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      notification,
    };
  }
}
