import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { HealthRepository } from './health.repository.js';

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const repository = { ping: vi.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(
      repository as unknown as HealthRepository,
    );

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });

  it('throws 503 when the database ping fails', async () => {
    const repository = { ping: vi.fn().mockRejectedValue(new Error('down')) };
    const controller = new HealthController(
      repository as unknown as HealthRepository,
    );

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
