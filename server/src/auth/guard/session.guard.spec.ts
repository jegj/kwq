import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RedirectException } from '../redirect/redirect.exception.js';
import { signAuthToken } from '../util/jwt.util.js';
import { SessionGuard } from './session.guard.js';

function makeContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

const SECRET = 'test-secret-with-enough-length-for-hs256';
const config = { get: () => SECRET } as any;

const tokenPayload = {
  id: 'user-1',
  role: 'ADMIN',
  email: 'javier@example.com',
};

describe('SessionGuard', () => {
  it('redirects to login when there is no session cookie', async () => {
    const guard = new SessionGuard({ findSessionUser: vi.fn() } as any, config);

    await expect(
      guard.canActivate(makeContext({ cookies: {} })),
    ).rejects.toBeInstanceOf(RedirectException);
  });

  it('redirects to login when the user no longer exists', async () => {
    const authService = { findSessionUser: vi.fn().mockResolvedValue(null) };
    const guard = new SessionGuard(authService as any, config);
    const cookies = { session: signAuthToken(tokenPayload, SECRET) };

    await expect(
      guard.canActivate(makeContext({ cookies })),
    ).rejects.toBeInstanceOf(RedirectException);
    expect(authService.findSessionUser).toHaveBeenCalledWith('user-1');
  });

  it('uses the role from the database, not the one in the token', async () => {
    const authService = {
      findSessionUser: vi.fn().mockResolvedValue({
        id: 'user-1',
        role: 'USER',
        email: 'javier@example.com',
      }),
    };
    const guard = new SessionGuard(authService as any, config);
    const request: Record<string, unknown> = {
      cookies: { session: signAuthToken(tokenPayload, SECRET) },
    };

    await guard.canActivate(makeContext(request));

    expect(request.user).toEqual({
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });
  });
});
