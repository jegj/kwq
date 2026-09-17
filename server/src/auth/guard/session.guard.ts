import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RedirectException } from '../redirect/redirect.exception.js';
import { verifyAuthToken } from '../util/jwt.util.js';

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.cookies?.session;
    const payload = token ? verifyAuthToken(token) : null;
    if (!payload) {
      throw new RedirectException('/auth/login');
    }
    request.user = payload;
    return true;
  }
}
