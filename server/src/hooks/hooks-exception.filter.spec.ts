import {
  type ArgumentsHost,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HooksExceptionFilter } from './hooks-exception.filter.js';

function run(exception: unknown) {
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ body: {} }),
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
  new HooksExceptionFilter().catch(exception, host);
  return reply;
}

describe('HooksExceptionFilter', () => {
  it('keeps the status of an HttpException (e.g. 401 for a bad token)', () => {
    const reply = run(new UnauthorizedException());

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('keeps the status of a validation error', () => {
    const reply = run(new BadRequestException('bad'));

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('turns unexpected errors into a 500 so the watcher retries', () => {
    const reply = run(new Error('db down'));

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
