import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AuthService } from '../auth.service.js';
import { RedirectException } from '../redirect/redirect.exception.js';
import {
  shouldRefreshAuthToken,
  signAuthToken,
  verifyAuthToken,
} from '../util/jwt.util.js';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../util/session-cookie.util.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const token = request.cookies?.session;
    const payload = token
      ? verifyAuthToken(token, this.config.get('JWT_SECRET'))
      : null;
    if (!token || !payload) {
      throw new RedirectException('/auth/login');
    }
    // The token only proves who signed in; role/email come from the DB so
    // demotions and deletions take effect immediately.
    const user = await this.authService.findSessionUser(payload.id);
    if (!user) {
      throw new RedirectException('/auth/login');
    }
    request.user = user;
    if (shouldRefreshAuthToken(token)) {
      http
        .getResponse<FastifyReply>()
        .setCookie(
          SESSION_COOKIE,
          signAuthToken(user, this.config.get('JWT_SECRET')),
          sessionCookieOptions(this.config.get('APP_ENV') !== 'development'),
        );
    }
    return true;
  }
}
