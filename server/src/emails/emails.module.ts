import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HooksModule } from '../hooks/hooks.module.js';
import { EmailsController } from './emails.controller.js';
import { EmailsRepository } from './emails.repository.js';
import { EmailsService } from './emails.service.js';

@Module({
  imports: [AuthModule, HooksModule],
  controllers: [EmailsController],
  providers: [EmailsService, EmailsRepository],
})
export class EmailsModule {}
