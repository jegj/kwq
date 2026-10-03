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

describe('AuthController', () => {
  describe('login', () => {
    it('re-renders the login page with an error on invalid credentials', async () => {
      const authService = { validateUser: vi.fn().mockResolvedValue(null) };
      const controller = new AuthController(authService as any);
      const reply = fakeReply();

      await controller.login({ email: 'javier@example.com', password: 'wrong' }, reply);

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
  });
});
