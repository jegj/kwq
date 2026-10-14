import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HooksModule } from '../hooks/hooks.module.js';
import { EmailsController } from './emails.controller.js';

@Module({
  imports: [AuthModule, HooksModule],
  controllers: [EmailsController],
})
export class EmailsModule {}
