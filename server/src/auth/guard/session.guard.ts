import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RedirectException } from '../redirect/redirect.exception.js';
import { AuthService } from '../auth.service.js';
import { verifyAuthToken } from '../util/jwt.util.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.cookies?.session;
    const payload = token ? verifyAuthToken(token) : null;
    if (!payload) {
      throw new RedirectException('/auth/login');
    }
    // The token only proves who signed in; role/email come from the DB so
    // demotions and deletions take effect immediately.
    const user = await this.authService.findSessionUser(payload.id);
    if (!user) {
      throw new RedirectException('/auth/login');
    }
    request.user = user;
    return true;
  }
}
