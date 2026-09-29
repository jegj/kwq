import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { hashWebhookToken } from '../util/webhook-token.util.js';
import { WebhookTokenGuard } from './webhook-token.guard.js';

function contextWithHeader(token?: string) {
  const request: any = { headers: token ? { 'x-kwq-token': token } : {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('WebhookTokenGuard', () => {
  it('activates and attaches webhookUser for a valid token', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'javier@example.com',
        }),
      },
    };
    const guard = new WebhookTokenGuard(prisma as any);
    const { context, request } = contextWithHeader('a-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { webhookToken: hashWebhookToken('a-token') },
    });
    expect(request.webhookUser).toEqual({
      id: 'user-1',
      email: 'javier@example.com',
    });
  });

  it('rejects when the header is missing', async () => {
    const prisma = { user: { findUnique: vi.fn() } };
    const guard = new WebhookTokenGuard(prisma as any);
    const { context } = contextWithHeader();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when no user matches the token', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const guard = new WebhookTokenGuard(prisma as any);
    const { context } = contextWithHeader('unknown-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
