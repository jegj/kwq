import type { FastifyReply } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('AuthController', () => {
  describe('login', () => {
    it('re-renders the login page with an error on invalid credentials', async () => {
      const authService = { validateUser: vi.fn().mockResolvedValue(null) };
      const controller = new AuthController(authService as any);
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
      const originalAppEnv = process.env.APP_ENV;
      afterEach(() => {
        process.env.APP_ENV = originalAppEnv;
      });

      async function loginCookieOptions() {
        const authService = {
          validateUser: vi
            .fn()
            .mockResolvedValue({ id: 'u1', role: 'USER', email: 'a@b.co' }),
          recordLogin: vi.fn(),
        };
        const reply = fakeReply();
        await new AuthController(authService as any).login(
          { email: 'a@b.co', password: 'pw' },
          reply,
        );
        return (reply.setCookie as any).mock.calls[0][2];
      }

      it('is Secure outside development and lasts 7 days', async () => {
        process.env.APP_ENV = 'production';
        expect(await loginCookieOptions()).toMatchObject({
          secure: true,
          maxAge: 7 * 24 * 60 * 60,
        });
      });

      it('is not Secure in development so http://localhost works', async () => {
        process.env.APP_ENV = 'development';
        expect(await loginCookieOptions()).toMatchObject({ secure: false });
      });
    });
  });
});
