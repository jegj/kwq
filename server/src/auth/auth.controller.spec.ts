import type { FastifyReply } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';

function fakeReply(): FastifyReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    view: vi.fn().mockReturnThis(),
    setCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  };
  return reply as any;
}

const SECRET = 'test-secret-with-enough-length-for-hs256';

function fakeConfig(appEnv = 'development') {
  const values: Record<string, string> = {
    APP_ENV: appEnv,
    JWT_SECRET: SECRET,
  };
  return { get: (key: string) => values[key] } as any;
}

describe('AuthController', () => {
  describe('login', () => {
    it('re-renders the login page with an error on invalid credentials', async () => {
      const authService = { validateUser: vi.fn().mockResolvedValue(null) };
      const controller = new AuthController(authService as any, fakeConfig());
      const reply = fakeReply();

      await controller.login(
        { email: 'javier@example.com', password: 'wrong' },
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.view).toHaveBeenCalledWith(
        'layout',
        expect.objectContaining({
          page: './pages/login',
          error: 'Invalid email or password',
        }),
      );
      expect(reply.redirect).not.toHaveBeenCalled();
    });

    describe('session cookie', () => {
      async function loginCookieOptions(appEnv: string) {
        const authService = {
          validateUser: vi
            .fn()
            .mockResolvedValue({ id: 'u1', role: 'USER', email: 'a@b.co' }),
          recordLogin: vi.fn(),
        };
        const reply = fakeReply();
        await new AuthController(authService as any, fakeConfig(appEnv)).login(
          { email: 'a@b.co', password: 'pw' },
          reply,
        );
        return (reply.setCookie as any).mock.calls[0][2];
      }

      it('is Secure outside development and lasts 15 days', async () => {
        expect(await loginCookieOptions('production')).toMatchObject({
          secure: true,
          maxAge: 15 * 24 * 60 * 60,
        });
      });

      it('is not Secure in development so http://localhost works', async () => {
        expect(await loginCookieOptions('development')).toMatchObject({
          secure: false,
        });
      });
    });
  });
});
