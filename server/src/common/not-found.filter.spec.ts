import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundExceptionFilter } from './not-found.filter.js';

function run(request: { method: string; accept?: string }, message: string) {
  const reply = {
    status: vi.fn().mockReturnThis(),
    view: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: request.method,
        headers: { accept: request.accept },
      }),
      getResponse: () => reply,
    }),
  };
  new NotFoundExceptionFilter().catch(
    new NotFoundException(message),
    host as any,
  );
  return reply;
}

describe('NotFoundExceptionFilter', () => {
  it('renders the 404 page, keeping the 404 status, for browser navigations', () => {
    const reply = run(
      { method: 'GET', accept: 'text/html,application/xhtml+xml' },
      'Transaction not found.',
    );

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.view).toHaveBeenCalledWith('layout', {
      title: 'Page not found',
      page: './pages/not-found',
      detail: 'Transaction not found.',
    });
  });

  it('hides Nest’s routing message for unknown URLs', () => {
    const reply = run(
      { method: 'GET', accept: 'text/html' },
      'Cannot GET /nope',
    );

    expect(reply.view).toHaveBeenCalledWith(
      'layout',
      expect.objectContaining({ detail: null }),
    );
  });

  it.each([
    { method: 'PATCH', accept: 'text/html' },
    { method: 'GET', accept: 'application/json' },
    { method: 'GET', accept: undefined },
  ])('keeps the JSON response for non-page requests %j', (request) => {
    const reply = run(request, 'Transaction not found.');

    expect(reply.view).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });
});
