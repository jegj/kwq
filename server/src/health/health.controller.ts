import {
  Controller,
  Get,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HealthRepository } from './health.repository.js';

// Unauthenticated on purpose: polled by the deploy playbook and uptime monitors.
// Throttled because every hit runs a query.
@UseGuards(ThrottlerGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly repository: HealthRepository) {}

  @Get()
  async check() {
    try {
      await this.repository.ping();
    } catch {
      throw new ServiceUnavailableException({ status: 'error' });
    }
    return { status: 'ok' };
  }
}
