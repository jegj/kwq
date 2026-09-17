import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GuestGuard } from './guard/guest.guard.js';
import { SessionGuard } from './guard/session.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GuestGuard, SessionGuard],
  exports: [SessionGuard],
})
export class AuthModule {}
