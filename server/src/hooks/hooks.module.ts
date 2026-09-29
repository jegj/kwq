import { Module } from '@nestjs/common';
import { HooksController } from './hooks.controller.js';

@Module({
  controllers: [HooksController],
})
export class HooksModule {}
