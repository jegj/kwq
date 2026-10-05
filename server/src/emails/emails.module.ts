import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailsController } from './emails.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [EmailsController],
})
export class EmailsModule {}
