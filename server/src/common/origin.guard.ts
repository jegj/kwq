import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { SKIP_ORIGIN_CHECK } from './skip-origin-check.decorator.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// PUBLIC_URL is the origin users reach the app at (the Caddy domain in prod).
export function resolveAllowedOrigin(
  publicUrl: string | undefined,
  port: string | undefined,
): string {
  return new URL(publicUrl || `http://localhost:${port ?? 3000}`).origin;
}

// Second layer behind SameSite=Lax: browsers always send Origin on
// cross-site mutations and a page can't forge it.
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly allowedOrigin: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_ORIGIN_CHECK,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const origin = request.headers.origin ?? this.originOfReferer(request);
    if (origin !== this.allowedOrigin) {
      throw new ForbiddenException('Cross-origin request blocked.');
    }
    return true;
  }

  private originOfReferer(request: {
    headers: { referer?: string };
  }): string | undefined {
    const referer = request.headers.referer;
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
