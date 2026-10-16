import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Render,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { SettingsService } from './settings.service.js';

const CURRENT_PATH = '/app/settings';

@Controller('app/settings')
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Render('app-layout')
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    return {
      title: 'Settings',
      page: './pages/settings',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      hasWebhookToken: await this.settingsService.hasWebhookToken(user.id),
    };
  }

  @Post('webhook-token')
  @HttpCode(200)
  generateWebhookToken(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.generateWebhookToken(user.id);
  }

  @Patch('password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ) {
    await this.settingsService.changePassword(user.id, body);
    return { success: true };
  }
}
