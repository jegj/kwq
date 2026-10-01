import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

// ponytail: ParseError never reaches here - HooksService swallows it into
// parseStatus FAILED and returns 200, since retrying a permanently
// unparseable email is pointless. Anything that does reach this filter is
// unexpected (a bug, a DB blip), so it gets a 500: kwq_watcher marks the
// email unseen and retries it next run, which is the right call for a
// transient failure.
@Catch()
export class HooksExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HooksExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    this.logger.error({
      msg: 'Unhandled error in hooks webhook',
      errorName: exception instanceof Error ? exception.name : typeof exception,
      errorMessage:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
      err: exception,
      messageId: (request.body as { messageId?: string } | undefined)
        ?.messageId,
      webhookUserId: request.webhookUser?.id,
    });

    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
  }
}
