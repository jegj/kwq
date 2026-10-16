import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';

// The user SessionGuard attached to the request. Use on session-guarded routes.
export function extractCurrentUser(
  _data: unknown,
  context: ExecutionContext,
): AuthenticatedUser {
  const { user } = context.switchToHttp().getRequest<FastifyRequest>();
  if (!user) throw new UnauthorizedException();
  return user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);
