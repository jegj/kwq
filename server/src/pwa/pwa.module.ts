import { Module } from '@nestjs/common';
import { PwaController } from './pwa.controller.js';

@Module({ controllers: [PwaController] })
export class PwaModule {}
