import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { PushSubscriptionStore } from './push.service.js';

@Controller('app/push')
@UseGuards(SessionGuard)
export class PushController {
  constructor(private readonly subscriptions: PushSubscriptionStore) {}

  @Post('subscriptions')
  @HttpCode(204)
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubscribeDto,
  ): Promise<void> {
    await this.subscriptions.save(user.id, body);
  }
}
