import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AdminGuard } from './guard/admin.guard.js';
import { GuestGuard } from './guard/guest.guard.js';
import { SessionGuard } from './guard/session.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    GuestGuard,
    SessionGuard,
    AdminGuard,
  ],
  exports: [AuthService, SessionGuard, AdminGuard],
})
export class AuthModule {}
