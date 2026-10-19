import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service.js';
import { DashboardService } from '../src/dashboard/dashboard.service.js';
import { createTestApp, signTestToken } from './bootstrap.js';

describe('DashboardController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
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
        .overrideProvider(DashboardService)
        .useValue({
          getMonthNav: () => ({
            month: '2026-10',
            label: 'October 2026',
            prev: '2026-09',
            next: null,
          }),
          getSummaries: async () => [],
        }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('/app/dashboard (GET) redirects to login when no session cookie is present', async () => {
    const response = await request(app.getHttpServer())
      .get('/app/dashboard')
      .expect(302);

    expect(response.headers.location).toBe('/auth/login');
  });

  it('/app/dashboard (GET) renders the dashboard for a valid session cookie', async () => {
    const token = signTestToken(app, {
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });

    const response = await request(app.getHttpServer())
      .get('/app/dashboard')
      .set('Cookie', `session=${token}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('javier@example.com');
  });
});
