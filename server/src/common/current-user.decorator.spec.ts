import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { extractCurrentUser } from './current-user.decorator.js';

const contextWith = (request: object) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

describe('extractCurrentUser', () => {
  it('returns the session user set by SessionGuard', () => {
    const user = { id: 'user-1', role: 'USER', email: 'user@example.com' };

    expect(extractCurrentUser(undefined, contextWith({ user }))).toBe(user);
  });

  it('throws Unauthorized when no guard set a user', () => {
    expect(() => extractCurrentUser(undefined, contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });
});
