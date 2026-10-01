import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RedirectException } from '../redirect/redirect.exception.js';

// Runs after SessionGuard, so request.user is already set.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.user?.role !== 'ADMIN') {
      throw new RedirectException('/app/dashboard');
    }
    return true;
  }
}
