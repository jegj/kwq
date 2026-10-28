import { SESSION_MAX_AGE_SECONDS } from './jwt.util.js';

export const SESSION_COOKIE = 'session';

export function sessionCookieOptions(secure: boolean) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
