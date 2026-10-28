import type { ExecutionContext } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { RedirectException } from '../redirect/redirect.exception.js';
import { signAuthToken } from '../util/jwt.util.js';
import { SessionGuard } from './session.guard.js';

function makeContext(
  request: Record<string, unknown>,
  reply: Record<string, unknown> = { setCookie: vi.fn() },
) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
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

  describe('sliding session', () => {
    const dbUser = { id: 'user-1', role: 'USER', email: 'javier@example.com' };
    const DAY_SECONDS = 24 * 60 * 60;

    it('re-issues the cookie when the token is past half of its life', async () => {
      const authService = {
        findSessionUser: vi.fn().mockResolvedValue(dbUser),
      };
      const guard = new SessionGuard(authService as any, config);
      const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * DAY_SECONDS;
      const stale = jwt.sign({ ...tokenPayload, iat: tenDaysAgo }, SECRET, {
        algorithm: 'HS256',
        expiresIn: '15d',
      });
      const reply = { setCookie: vi.fn() };

      await guard.canActivate(
        makeContext({ cookies: { session: stale } }, reply),
      );

      expect(reply.setCookie).toHaveBeenCalledTimes(1);
      const [name, value, options] = reply.setCookie.mock.calls[0];
      expect(name).toBe('session');
      expect(value).not.toBe(stale);
      expect(options).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * DAY_SECONDS,
      });
    });

    it('leaves a fresh token alone', async () => {
      const authService = {
        findSessionUser: vi.fn().mockResolvedValue(dbUser),
      };
      const guard = new SessionGuard(authService as any, config);
      const reply = { setCookie: vi.fn() };
      const cookies = { session: signAuthToken(tokenPayload, SECRET) };

      await guard.canActivate(makeContext({ cookies }, reply));

      expect(reply.setCookie).not.toHaveBeenCalled();
    });
  });
});
