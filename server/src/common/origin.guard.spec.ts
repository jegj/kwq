import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { OriginGuard } from './origin.guard.js';
import { SkipOriginCheck } from './skip-origin-check.decorator.js';

const ALLOWED = 'https://kwq.example.com';

class PlainController {
  handle() {}
}

@SkipOriginCheck()
class WebhookController {
  handle() {}
}

function run(
  request: { method: string; headers: Record<string, string> },
  controller: new () => { handle(): void } = PlainController,
) {
  const guard = new OriginGuard(new Reflector(), ALLOWED);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getClass: () => controller,
    getHandler: () => controller.prototype.handle,
  } as unknown as ExecutionContext;
  return () => guard.canActivate(context);
}

describe('OriginGuard', () => {
  it('lets safe methods through without an origin', () => {
    expect(run({ method: 'GET', headers: {} })()).toBe(true);
  });

  it('allows a mutation from the same origin', () => {
    const request = { method: 'POST', headers: { origin: ALLOWED } };
    expect(run(request)()).toBe(true);
  });

  it('blocks a mutation from another origin', () => {
    const request = {
      method: 'DELETE',
      headers: { origin: 'https://evil.test' },
    };
    expect(run(request)).toThrow(ForbiddenException);
  });

  it('blocks a mutation with neither Origin nor Referer', () => {
    expect(run({ method: 'PATCH', headers: {} })).toThrow(ForbiddenException);
  });

  it('falls back to the Referer origin', () => {
    const request = {
      method: 'POST',
      headers: { referer: `${ALLOWED}/app/categories` },
    };
    expect(run(request)()).toBe(true);
  });

  it('blocks a foreign or malformed Referer', () => {
    const foreign = {
      method: 'POST',
      headers: { referer: 'https://evil.test/x' },
    };
    const malformed = { method: 'POST', headers: { referer: 'not a url' } };
    expect(run(foreign)).toThrow(ForbiddenException);
    expect(run(malformed)).toThrow(ForbiddenException);
  });

  it('skips the check for controllers marked @SkipOriginCheck', () => {
    expect(run({ method: 'POST', headers: {} }, WebhookController)()).toBe(
      true,
    );
  });
});
