import type { AuthTokenPayload } from './auth.types.js';

// ponytail: @fastify/cookie ships this same augmentation, but its own
// resolution of 'fastify' doesn't line up with ours across the npm
// workspace hoist, so the merge silently drops. Declaring the bits we use
// here sidesteps that instead of fighting the workspace layout.
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthTokenPayload;
    cookies: { [cookieName: string]: string | undefined };
  }

  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ): FastifyReply;
    clearCookie(name: string, options?: Record<string, unknown>): FastifyReply;
  }
}
