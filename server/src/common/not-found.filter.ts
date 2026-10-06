import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Nest's own message for unmatched routes ("Cannot GET /x") is routing noise,
// not something to show a person.
const ROUTING_MESSAGE_PREFIX = 'Cannot ';

@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status = reply.status(HttpStatus.NOT_FOUND);

    // JSON callers (Alpine fetch PATCH/DELETE, API clients) keep the JSON body.
    const wantsPage =
      request.method === 'GET' &&
      (request.headers.accept ?? '').includes('text/html');
    if (!wantsPage) {
      return status.send(exception.getResponse());
    }

    const message = exception.message;
    return status.view('layout', {
      title: 'Page not found',
      page: './pages/not-found',
      detail: message.startsWith(ROUTING_MESSAGE_PREFIX) ? null : message,
    });
  }
}
