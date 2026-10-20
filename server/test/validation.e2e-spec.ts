import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailsService } from '../src/emails/emails.service.js';
import { createTestApp, signTestToken } from './bootstrap.js';

describe('Global ValidationPipe (e2e)', () => {
  let app: NestFastifyApplication;
  const list = vi.fn();

  beforeEach(async () => {
    list.mockReset().mockResolvedValue({});
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(AuthService)
        .useValue({
          findSessionUser: async (id: string) => ({
            id,
            role: 'USER',
            email: 'javier@example.com',
          }),
        })
        .overrideProvider(EmailsService)
        .useValue({ list }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  const sessionCookie = () =>
    `session=${signTestToken(app, { id: 'user-1', role: 'USER', email: 'javier@example.com' })}`;

  it('rejects unknown query params with 400', async () => {
    await request(app.getHttpServer())
      .get('/app/emails?utm_source=newsletter')
      .set('Cookie', sessionCookie())
      .expect(400);

    expect(list).not.toHaveBeenCalled();
  });

  it('lets known query params through to the service', async () => {
    await request(app.getHttpServer())
      .get('/app/emails?month=2026-10&status=PARSED')
      .set('Cookie', sessionCookie());

    expect(list).toHaveBeenCalledWith('user-1', {
      month: '2026-10',
      status: 'PARSED',
    });
  });
});
