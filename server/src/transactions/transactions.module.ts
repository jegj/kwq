import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TransactionsController } from './transactions.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
