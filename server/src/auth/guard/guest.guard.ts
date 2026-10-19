import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { RedirectException } from '../redirect/redirect.exception.js';
import { verifyAuthToken } from '../util/jwt.util.js';

// Guards the login page: an already-authenticated visitor is sent straight
// to the dashboard instead of seeing the form again.
@Injectable()
export class GuestGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.cookies?.session;
    if (token && verifyAuthToken(token, this.config.get('JWT_SECRET'))) {
      throw new RedirectException('/app/dashboard');
    }
    return true;
  }
}
