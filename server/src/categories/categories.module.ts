import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CategoriesController } from './categories.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
