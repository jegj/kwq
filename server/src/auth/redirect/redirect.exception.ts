import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

// ponytail: guards throw this instead of returning false so a redirect can
// be sent cleanly, rather than fighting Nest's default 403 response.
export class RedirectException extends Error {
  constructor(public readonly location: string) {
    super(`Redirect to ${location}`);
  }
}

@Catch(RedirectException)
export class RedirectExceptionFilter implements ExceptionFilter {
  catch(exception: RedirectException, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    reply.status(HttpStatus.FOUND).redirect(exception.location);
  }
}
