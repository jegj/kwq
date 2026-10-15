import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HooksModule } from '../hooks/hooks.module.js';
import { TransactionsController } from './transactions.controller.js';

@Module({
  imports: [AuthModule, HooksModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
